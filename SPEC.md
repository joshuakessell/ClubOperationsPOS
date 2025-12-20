# Club Operations POS - Technical Specification (Source of Truth)

## 1. Overview

ClubOperationsPOS is a server-authoritative operations system for a private club. It coordinates:

- Customer check-ins (two lanes)
- Room/locker assignment with live inventory and safe concurrency
- Renewals and final extensions for a single visit
- Optional waitlists and upgrades (no refunds, upgrades do not extend time)
- Cleaning workflow for rooms using a cleaning station kiosk
- Checkout workflow initiated by customers with employee verification
- Admin tools (staff management, passkeys/PINs) and operational metrics
- Manual integration with Square POS (Square runs on separate iPads)

All critical decisions are made on the server and pushed to clients via WebSockets.

---

## 2. Apps in the Monorepo

### 2.1 Customer Kiosk (`apps/customer-kiosk`)
**Context**: Customer-facing tablet at each check-in lane.

**Idle state**
- Displays Club Dallas logo only.
- Black background, white text theme consistent with Club Dallas branding.

**Active session state**
- Displays:
  - Customer name (populated from ID scan performed by staff)
  - Membership number if scanned/provided
- Shows rental options:
  - Locker
  - Standard Room
  - Double Room
  - Special Room
  - Gym Locker (only if customer membership is in an eligible grandfathered range)

**Selection rules**
- Customer selects their preferred rental type.
- Buttons are never disabled. If unavailable, show a modal:
  - "None available. Join waiting list?"
  - Provide an estimated time until next availability:
    - based on next scheduled checkout for that tier + 10-minute cleaning buffer
- If fewer than 3 units remain for a tier, display an urgency message under that option.

**Waitlist and backup**
- If customer joins a waitlist, they must choose a backup rental that is available now.
- The system charges only for the backup rental at check-in (no refunds).

**Upgrade disclaimer**
- Only shown when customer elects a waitlist/upgrade path.
- Acknowledged via OK button (no signature required).
- Must clearly state:
  - Upgrade time estimates are not guarantees
  - Upgrade fee is charged only if/when upgrade occurs
  - Upgrade does not extend stay; applies only to remaining time in the original block
  - No refunds

**Agreement contract and signature**
- After rental selection is finalized (and any required customer confirmations), the customer must sign an agreement for:
  - initial check-in block
  - renewal block
- Agreement text is a placeholder for now (no actual contract text included).
- Captures digital signature and sends it to server to store with the associated block.

**Real-time updates**
- Inventory changes, assignments, and customer session updates are pushed via WebSockets.

---

### 2.2 Employee Register (`apps/employee-register`)
**Context**: Employee-facing tablet at each lane. Runs alongside Square POS on separate iPads.

**Authentication**
- Staff must authenticate at start of shift via WebAuthn (fingerprint/passkey) or PIN fallback.
- Remains logged in until staff signs out.

**Modes**
- CHECKIN mode (default)
- RENEWAL mode (toggle)
- (Optional) CHECKOUT-ASSIST mode for claim/verify notifications

**Lane session creation**
- Staff scans customer ID using existing barcode scanner (keyboard wedge).
- Staff may also scan membership card (mag stripe is present in reality; system stores membership number as data input).
- This creates/updates a lane session and triggers the customer kiosk to leave idle state.

**Inventory presentation**
- Organized by collapsible sections:
  - Special Rooms
  - Double Rooms
  - Standard Rooms
  - Lockers (collapsed by default; expandable grid 001–108)
- Auto-expands the section matching what the customer selected.
- If customer joined waitlist and chose a backup option that is available, expand the backup option.

**Sorting within a room tier**
1) Available (CLEAN and unoccupied) at top
2) Occupied but expiring soon next (sorted by soonest checkout)
3) Recently reserved rooms last

**Assignment behavior**
- System auto-selects the first available unit for the chosen type.
- Staff can override by selecting a different unit of the same type.
- Staff must click Assign to commit.
- Assignments are server-authoritative and must be transactionally safe (row locking).
- If staff assigns a different type than customer selected, customer kiosk must show a confirmation prompt:
  - Customer must accept before proceeding to agreement signature.

**Pricing display**
- Employee register displays price quote line items and totals.
- Payment is taken in Square; then staff marks payment intent as paid within this system.

**Renewal mode**
- Renewal is initiated for a customer who is already inside the club.
- After selecting rental for renewal, show renewal disclaimer:
  - Renewal adds 6 hours from the previous block end time.
  - Notice that the customer is approaching a 14-hour maximum stay (2 blocks of 6 hours + final optional 2 hours).
  - At the end of the second 6-hour block, customer may extend one final time by 2 hours for a flat $20 (not charged during renewal; only disclosed).
- Renewal requires agreement signature (same placeholder contract) for each new 6-hour block.

---

### 2.3 Cleaning Station Kiosk (`apps/cleaning-station-kiosk`)
**Context**: Staff kiosk mounted by dirty/clean key hooks.

**Authentication**
- Staff must authenticate via WebAuthn or PIN before each cleaning action batch.
- After completing Begin or Finish, kiosk returns to lock screen requiring re-auth.

**Primary workflow**
- No per-key scanning required (QR/camera is optional or future).
- Displays two live lists:
  - DIRTY rooms
  - CLEANING rooms
- Staff selects one or more rooms from ONE list only:
  - Selecting from DIRTY disables CLEANING list
  - Selecting from CLEANING disables DIRTY list
- Action button:
  - "Begin Cleaning" changes selected rooms DIRTY → CLEANING
  - "Finish Cleaning" changes selected rooms CLEANING → CLEAN

**Mixed-status guard**
- UI prevents mixed-status batch by design.
- Server still validates transitions; overrides require explicit confirmation and reason.

**Metrics**
- Begin and Finish events are recorded with staff attribution.
- Overrides and anomalies are excluded from performance statistics.

---

### 2.4 Checkout Kiosk (`apps/checkout-kiosk`)
**Context**: Customer-facing kiosk inside the club for checkout initiation.

**Idle state**
- Displays Club Dallas logo only.

**Checkout start**
- Customer taps "Begin Checkout"
- Front camera is shown with instructions to scan QR on room/locker key

**Checklist**
- Locker: locker key + towel
- Room: room key + sheets + TV remote (if assigned)
- Shows notice:
  - "A staff member must verify all items."
  - "Sheets/towels may go into laundry bin."
  - "Keys/remotes must be handed to staff."

**Submit + staff verification**
- When customer submits checklist, employee register devices receive a notification bar.
- The first staff member to claim it owns the checkout.
- Staff verifies items physically, resolves late fees, and completes checkout.

**Late checkout fees and bans**
- If checkout begins 30+ minutes late:
  - 30–59 minutes: $15 fee
  - 60–89 minutes: $35 fee
  - 90+ minutes: $35 fee + 30-day ban applied immediately
- If banned flag exists, it must be checked at check-in and block check-in if active.

**Payment**
- Late fees must be paid in Square before completion.
- Staff marks payment intent paid in this system.
- Checkout completes only after required fees are settled.

**Return to idle**
- After completion, kiosk displays a short completion message and returns to logo after ~10 seconds.

---

### 2.5 Office Dashboard (`apps/office-dashboard`)
**Context**: Office PC web app.

**Admin-only capabilities**
- Create staff accounts, assign roles (STAFF, ADMIN)
- Set/reset staff PIN
- Manage WebAuthn credentials (list/revoke)
- View audit logs

**Admin metrics view**
- Rooms occupied/unoccupied
- Expiration lists:
  - Overdue at top (red), sorted most overdue first
  - Expiring within 30 minutes next, sorted by soonest expiration
- Cleaning performance:
  - Avg dirty duration
  - Avg time to start cleaning once room becomes dirty
  - Avg cleaning duration
  - Filter by shift range and by staff member

---

## 3. Club Business Rules

### 3.1 Time Blocks (Visit Rules)
- A standard check-in is 6 hours.
- A renewal adds another 6 hours.
- After two 6-hour blocks, a final optional extension is 2 hours for a flat $20.
- Upgrades do not extend time; apply only to remaining time in the current block.

### 3.2 Room Inventory and Tiers

Room tiers:
- Standard
- Double
- Special

Special rooms:
- 201, 232, 256

Double rooms:
- 216, 218, 232, 252, 256, 262
  - Note: 232 and 256 are Special tier (Special overrides Double classification)

All other rooms described below are Standard.

Room numbering:
- Even rooms 200 through 262 are on the outer perimeter, clockwise.
- Odd rooms 201 through 245 are on the inner perimeter, clockwise.
- Exceptions:
  - 201 is Special
  - 225 is not Standard (treated as excluded or special handling if it exists in the building; if 225 is present, its tier must be explicitly configured in DB seed/config)

Implementation note:
- The system should store tier per room row (do not rely only on computed rules at runtime).
- Seed logic should build room rows consistently and explicitly.

### 3.3 Base Pricing (Rooms)
Base room prices:
- Standard: $30
- Double: $40
- Special: $50

Weekday discount window:
- Monday 8:00am through Friday 4:00pm
- Discount is $3 off each room type during this window.

Youth pricing (age 18–24 inclusive):
- Standard room: $30 any day
- Double or Special room: $50 any day

### 3.4 Locker Pricing
Non-youth locker prices:
- Weekdays (Mon 8am to Fri 4pm): $16 (Early Bird)
- Weekday nights (Mon–Thu 4pm to 8am): $19
- Weekends: $24

Youth locker pricing (18–24 inclusive):
- Weekdays (Mon 8am to Fri 4pm): free
- Outside that window: $7

### 3.5 Membership Fees
- Guests age 25+ must pay a one-time membership fee: $13, unless they have a valid 6-month membership.
- 6-month membership card costs: $43.
- If membership is valid, the per-checkin membership fee is waived.

### 3.6 Gym Locker Eligibility
- Certain grandfathered membership-number ranges unlock Gym Locker option (no cost).
- No new gym-locker memberships will be issued.
- Eligibility is determined server-side based on membership number.

### 3.7 Waitlist and Upgrades
No refunds, ever.

Waitlist:
- Customer can select an unavailable desired rental and join waitlist.
- Customer must select a backup rental that is available now and is charged for that backup at check-in.

Upgrade fees (flat, independent of day/time/age discounts):
- Locker → Standard: $8
- Locker → Double: $17
- Locker → Special: $27
- Standard → Double: $9
- Standard → Special: $19
- Double → Special: $9

Upgrade disclaimer:
- Shown only when customer elects waitlist/upgrade path.
- Acknowledgement only (OK), no signature.
- Must state upgrades do not extend time, and fees are charged only at upgrade time.

### 3.8 Checkout Late Fees and Ban
If checkout begins late (>= 30 minutes after scheduled checkout):
- 30–59 minutes: $15 fee
- 60–89 minutes: $35 fee
- 90+ minutes: $35 fee + 30-day ban

Bans:
- If banned_until is in the future, check-in must be blocked and staff must be notified.

---

## 4. Authentication and Session Identity

Employee authentication:
- WebAuthn (passkey/biometric) is preferred.
- PIN fallback must exist.
- Every action that changes state must be attributable to an authenticated staff member.

Session behavior:
- Employee Register stays logged in until sign out.
- Cleaning Station returns to lock after each Begin/Finish batch.

---

## 5. Server Authoritative Model

- All assignments are validated and committed by server transactions.
- Row locking prevents double booking.
- All state transitions are validated server-side.
- All state-changing actions create audit_log entries.

---

## 6. Data Model (Logical)

Key entities:
- staff
- staff_webauthn_credentials
- customers
- rooms
- lockers
- visits
- checkin_blocks (6-hour blocks, plus optional final 2-hour extension)
- lane_sessions (ties together employee register and customer kiosk at a lane)
- payment_intents (quotes computed here; payment happens in Square; staff marks paid)
- agreement_signatures
- waitlist_entries
- upgrades
- checkout_requests
- cleaning_events
- audit_log

---

## 7. API and Realtime Events

### REST API principles
- All endpoints are versioned under `/v1`.
- All request bodies validated with Zod.
- Admin endpoints require ADMIN role.
- Staff endpoints require authenticated session.

### WebSocket events (server → client)
- INVENTORY_UPDATED
- LANE_SESSION_UPDATED
- CHECKOUT_REQUEST_SUBMITTED
- CHECKOUT_REQUEST_CLAIMED
- CHECKOUT_REQUEST_RESOLVED
- ROOM_STATUS_CHANGED
- AUDIT_LOG_APPENDED (optional)

Clients subscribe based on their device role.

---

## 8. UI Branding Direction

- Black background, white typography where possible.
- Customer kiosk idle screen shows Club Dallas logo centered.
- When session begins, logo moves to corner and UI becomes a clean, minimal layout.
- Visual direction should lean heavily toward the brand feel of clubsaunas.com (Dallas page included) while staying within the system's functionality constraints.

---

## 9. Testing Requirements

- Pricing engine: exhaustive edge case tests (time windows, age boundaries, membership fee logic)
- Assignment concurrency: tests for double booking prevention
- Checkout late fee + ban rules: tests for all thresholds
- Cleaning workflow: tests for batch begin/finish and metrics exclusion rules
- Auth: WebAuthn challenge expiration and credential revocation tests
- Integration tests should run with Postgres available; tests should also fail loudly if DB is missing

---

## 10. Development Roadmap (Phased)

Phase 1:
- Authentication (WebAuthn + PIN), staff admin management (create/reset/revoke)
- Audit logging foundation

Phase 2:
- End-to-end check-in flow: lane sessions, customer selection, assignment, quote, payment intent, agreement signature

Phase 3:
- Cleaning station workflow: list-based queues, batch begin/finish, staff attribution, lock-screen reauth behavior

Phase 4:
- Checkout kiosk flow: scan → checklist → submit → staff claim/verify → late fees/bans → completion

Phase 5:
- Office admin metrics dashboard: expirations, cleaning metrics, staff productivity summaries
