# SCHEMA_OVERVIEW.md
## ClubOperationsPOS Canonical Data Schema (Conceptual Source of Truth)

This document defines the **overarching schema** for ClubOperationsPOS: employees, authentication, customers, visits, check-in/checkout logs, Square-adjacent payment logs, inventory state, and staff performance metrics.

### Relationship to other canonical artifacts
- **db/schema.sql** is the *generated snapshot* of the current database state from migrations.
- **openapi.yaml** is the *API contract target* and must match implemented endpoints.
- **packages/shared** contains canonical enums + Zod schemas used across apps/services.
- This document defines **meaning + linkage** between entities so future changes remain consistent.

---

## 1) Core goals and invariants
1. The server is authoritative for inventory, assignment, pricing, and state transitions.
2. Every state-changing action must be attributable to a staff member (auditability).
3. Concurrency-sensitive actions (assigning rooms/lockers, claiming checkouts) must be transaction-safe.
4. Metrics must be computed from events/logs, excluding overrides and anomalies.

---

## 2) Primary entities and their relationships (ERD-style narrative)

### Staff
**Staff** represent employees who operate registers, kiosks, cleaning stations, and admin tools.

- `staff` (identity + role)
- `staff_sessions` (logged-in sessions for web apps)
- `staff_webauthn_credentials` (passkeys)
- `webauthn_challenges` (short-lived, single-use challenges)
- `audit_log` links actions back to staff and device

**Relationships**
- staff 1→N staff_sessions
- staff 1→N staff_webauthn_credentials
- staff 1→N audit_log entries

### Devices
Devices identify the source of actions (register tablet, cleaning station, checkout kiosk, etc).
- `devices` (optional but recommended if not present yet)
- referenced by `audit_log` and “deviceId” fields in cleaning/checkin flows

**Relationship**
- device 1→N audit_log entries

### Customers and memberships
Customers are created/updated by ID scans and optionally membership card scans.
- `customers` (canonical customer identity table)
  - ID scan is initiated on employee-register via rear camera PDF417 barcode scanning
  - The decoded barcode is parsed into customer fields (name, DOB, ID number, issuer)
  - Server computes `id_scan_hash` (SHA-256 of normalized raw barcode) and upserts customer
  - Membership remains optional metadata, added later via membership card scan
- `memberships` (membership_number, validity, ban flags) - optional metadata on customers
- optional `membership_number_ranges` for gym-locker eligibility rules

**Relationships**
- customer 1→N visits
- customer 0..1 memberships (membership is optional metadata on customers)

### Visits and time blocks
A visit represents a customer’s presence in the club; blocks are timed entitlements.
- `visits` (ACTIVE/COMPLETED)
- `checkin_blocks` (INITIAL_6H / RENEWAL_6H / FINAL_2H)

**Relationships**
- customer 1→N visits
- visit 1→N checkin_blocks
- checkin_blocks 0..1 agreement_signatures

### Lane sessions (check-in orchestration)
Lane sessions represent the in-progress workflow across:
- employee register tablet (scans + assignment)
  - ID scan is initiated via rear camera PDF417 barcode scanning
  - Scanned ID is sent to `POST /v1/checkin/lane/:laneId/scan-id` endpoint
  - Server upserts customer based on `id_scan_hash` and updates lane session
- customer kiosk (selection + signature)

- `lane_sessions` (status, lane_id, mode CHECKIN/RENEWAL, customer reference, current selection state)
  - Two-sided selection state: `proposed_rental_type`, `proposed_by` ('CUSTOMER'/'EMPLOYEE'), `selection_confirmed` (boolean), `selection_confirmed_by`, `selection_locked_at`
  - Waitlist fields: `waitlist_desired_type`, `backup_rental_type`
  - Disclaimers: `disclaimers_ack_json` (stores upgrade disclaimer acknowledgements, no signature)

**Relationships**
- lane_session → customer (required once started via ID scan)
- lane_session → visit/block (once completed/assigned)

### Inventory: rooms and lockers
- `rooms` (room_number, tier: STANDARD/DOUBLE/SPECIAL, status: DIRTY/CLEANING/CLEAN/OCCUPIED)
- `lockers` (locker_number 1..108, status)
- optional `occupancies` / `inventory_assignments` table (recommended) linking current block to asset

**Relationships**
- checkin_block 0..1 assigned room or locker (via assignment/occupancy record)
- room 1→N room_status_events
- locker 1→N locker_status_events (optional)

### Agreements and disclaimers
Contracts are signed per block. Upgrade disclaimers are acknowledgements only.
- `agreements` (versioned text, placeholder body allowed)
- `agreement_signatures` (signature capture, stored per checkin_block for INITIAL/RENEWAL only)
- Upgrade disclaimer acknowledgements stored in `lane_sessions.disclaimers_ack_json` (ack only, no signature)

**Relationships**
- agreement 1→N agreement_signatures
- agreement_signature → checkin_block (required, only for INITIAL/RENEWAL block types)
- upgrade disclaimer acknowledgements → lane_session (via disclaimers_ack_json JSONB field)

### Checkout workflow
Customer initiates via checkout kiosk; employee claims and verifies.
- `checkout_requests` (SUBMITTED → CLAIMED → VERIFIED)
- `late_checkout_events` (fee tiers + ban info)

**Relationships**
- checkout_request → checkin_block/occupancy (required)
- checkout_request → staff (claimed_by)
- late_checkout_event → checkin_block

### Payments and Square-adjacent reconciliation
Square runs externally; this system tracks what should be paid and whether staff confirmed payment.
- `payment_intents` (purpose: CHECKIN/RENEWAL/LATE_FEE/UPGRADE/MEMBERSHIP_FEE/FINAL_EXTENSION_2H)
  - Note: purpose is conceptual unless DB has a purpose column; do not invent columns
- optional `square_event_log` if webhooks/imports are added later

**Relationships**
- payment_intent → visit (required)
- payment_intent → checkin_block (optional depending on purpose)
- payment_intent → staff (marked_paid_by)
- payment_intent → lane_session (via lane_session_id)

### Audit log (mandatory)
Audit log is the backbone for traceability.
- `audit_log` with (actor staff, action, entity, before/after, meta)

**Relationships**
- audit_log → staff (actor)
- audit_log → entity (polymorphic ref)

---

## 3) Metrics model (derived, not stored as truth)

### Cleaning metrics (derived from events)
Compute from:
- `room_status_events` OR `cleaning_events` if present

Metrics:
- Dirty→Cleaning response time
- Cleaning duration
- Rooms cleaned per staff per range

**Exclusions**
Exclude from metrics any event where:
- override=true OR override_flag=true OR excluded_from_metrics=true
- durations < 30s or > 4h, negative, missing timestamps

### Register/checkout operational metrics (derived from audit/checkout)
Compute:
- checkins per staff per range
- renewals per staff
- checkouts claimed/verified per staff
- late fee incidents handled per staff

---

## 4) Linking to current API routes (must stay aligned with openapi.yaml)

This repo currently includes (non-exhaustive, must reflect actual implemented routes):
- Auth: PIN login + reauth, WebAuthn register/auth endpoints
- Admin: staff create/update/reset pin, passkey listing/revoke, audit access
- Check-in: lane session start/select/assign/payment intent/sign agreement/confirm
- Keys: resolve key token
- Cleaning: batch operations with server-side transition validation
- Checkout: resolve key, create checkout request, claim/verify, fee paid marking, bans
- Visits: create/renew blocks

**Rule**
When routes change, update:
1) `openapi.yaml` to match
2) `packages/shared` schemas if new request/response types are introduced
3) add migrations if DB changes are required

---

## 5) Canonical enums and configuration
Canonical enums must live in `packages/shared` (and mirror DB enums):
- RoomStatus: DIRTY, CLEANING, CLEAN, OCCUPIED
- RoomTier: STANDARD, DOUBLE, SPECIAL
- PaymentPurpose
- LaneSessionMode: CHECKIN, RENEWAL
- CheckoutRequestStatus: SUBMITTED, CLAIMED, VERIFIED, CANCELLED
- StaffRole: STAFF, ADMIN

Pricing rules and room-number tier mapping must remain deterministic and centrally defined.

---

## 6) Practical reporting views (admin)
The office dashboard should be able to query:
- Occupancy summary
- Expirations list: overdue first, then expiring within 30 minutes
- Cleaning metrics: overall + per staff + time range
All of these should be computed server-side for consistency.

---

End of schema overview.
