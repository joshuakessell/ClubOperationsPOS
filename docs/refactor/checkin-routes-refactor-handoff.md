# Check-in routes refactor — handoff (what’s left)

## Goal (do not change behavior)

Refactor `services/api/src/routes/checkin.ts` into small modules under `services/api/src/checkin/`, keeping runtime behavior identical and keeping API contract unchanged. The target end state is a **thin router file** that only wires routes and delegates to handler registrars.

Source-of-truth reminders:
- `SPEC.md` (behavior)
- `openapi.yaml` (contract)
- DB docs under `docs/database/*` and `db/schema.sql` (schema meaning)

## What is already done

### New module structure exists

- `services/api/src/checkin/types.ts` — shared DB row interfaces + check-in types
- `services/api/src/checkin/service.ts` — shared helper/business logic extracted from the original big route file
- `services/api/src/checkin/validators.ts` — Zod request schemas (start + scan so far)
- `services/api/src/checkin/handlers/` — route group registrars
  - `start.ts` — `POST /v1/checkin/lane/:laneId/start`
  - `scan.ts` — `POST /v1/checkin/scan`
  - `scanId.ts` — `POST /v1/checkin/lane/:laneId/scan-id`
  - `selection.ts` — selection workflow endpoints (select/propose/confirm/ack + waitlist-info)
  - `index.ts` — exports the registrars

### `routes/checkin.ts` already delegates some routes

At the top of `checkinRoutes()`, it calls:
- `registerCheckinStartRoutes(fastify)`
- `registerCheckinScanRoutes(fastify)`
- `registerCheckinScanIdRoutes(fastify)`
- `registerCheckinSelectionRoutes(fastify)`

These blocks have been removed from `routes/checkin.ts` and moved into `services/api/src/checkin/handlers/*`.

## What still lives in `routes/checkin.ts` (needs extraction)

As of now, `services/api/src/routes/checkin.ts` still defines the following endpoints directly (and should be moved into `services/api/src/checkin/handlers/*`):

### Assignment / confirmation

- `POST /v1/checkin/lane/:laneId/assign`
- `POST /v1/checkin/lane/:laneId/customer-confirm`

Suggested new handler module:
- `services/api/src/checkin/handlers/assignment.ts`
  - exports `registerCheckinAssignmentRoutes(fastify)`

Notes:
- Uses `serializableTransaction` and `FOR UPDATE` locks to prevent double-booking.
- Broadcasts `SESSION_UPDATED` (full lane session snapshot) after assignment-related mutations.
- **Preserve existing behavior exactly**, even if something looks odd.

### Payment / intents

- `POST /v1/checkin/lane/:laneId/create-payment-intent`
- `POST /v1/payments/:id/mark-paid`
- `POST /v1/checkin/lane/:laneId/demo-take-payment`

Suggested new handler module:
- `services/api/src/checkin/handlers/payment.ts`
  - exports `registerCheckinPaymentRoutes(fastify)`

Notes:
- `create-payment-intent` uses `calculatePriceQuote` and enforces “at most one DUE payment intent”, reusing/cancelling extras.
- `mark-paid` also contains special-case audit logging for certain quote types; keep the logic identical.
- `demo-take-payment` is staff-only and updates `payment_intents` + session status; keep field names and side effects identical.

### Agreement / completion

- `POST /v1/checkin/lane/:laneId/sign-agreement` (optional auth; kiosk calls it)
- `POST /v1/checkin/lane/:laneId/manual-signature-override` (staff-only)

Suggested new handler module:
- `services/api/src/checkin/handlers/agreement.ts`
  - exports `registerCheckinAgreementRoutes(fastify)`

Notes:
- These handlers are “heavy”: PDF generation, inventory assignment (`rooms`/`lockers`), creation of `visits` + `checkin_blocks`, audit writes, late-fee note cleanup, waitlist persistence, broadcasts + `broadcastInventoryUpdate`.
- **Do not “fix” suspicious SQL/table names during refactor**. There are a couple places that look inconsistent (e.g., `audit_log` vs `audit_logs`); treat these as “behavior” and preserve them unless specs explicitly say otherwise.

### Office/dashboard support

- `GET /v1/checkin/lane-sessions` (staff-only; office dashboard)

Suggested new handler module:
- `services/api/src/checkin/handlers/laneSessions.ts`
  - exports `registerCheckinLaneSessionsRoutes(fastify)`

### Past-due flow (demo + bypass)

- `POST /v1/checkin/lane/:laneId/past-due/demo-payment`
- `POST /v1/checkin/lane/:laneId/past-due/bypass` (requires admin PIN)

Suggested new handler module:
- `services/api/src/checkin/handlers/pastDue.ts`
  - exports `registerCheckinPastDueRoutes(fastify)`

### Language / notes / membership / misc

- `POST /v1/checkin/lane/:laneId/set-language`
- `GET /v1/checkin/lane/:laneId/set-language` (compat helper)
- `POST /v1/checkin/lane/:laneId/membership-purchase-intent` (optional auth)
- `POST /v1/checkin/lane/:laneId/complete-membership-purchase` (staff-only)
- `POST /v1/checkin/lane/:laneId/add-note` (staff-only)
- `POST /v1/checkin/lane/:laneId/reset` (staff-only)
- `POST /v1/checkin/lane/:laneId/kiosk-ack` (optional auth)

Suggested modules (pick either grouping; keep files small):
- Option A (more granular):
  - `handlers/language.ts` (POST+GET set-language)
  - `handlers/membership.ts` (membership-purchase-intent + complete-membership-purchase)
  - `handlers/notes.ts` (add-note)
  - `handlers/reset.ts` (reset + kiosk-ack)
- Option B (fewer files):
  - `handlers/misc.ts` (all of the above)

Important:
- `routes/checkin.ts` currently has an internal helper `setLanguageForLaneSession(...)`. Move it into:
  - `handlers/language.ts` as a local helper, OR
  - `checkin/service.ts` as a shared helper (if reused).
  Either is fine; the goal is to make `routes/checkin.ts` thin.

## Recommended next extraction order (low risk → high risk)

1) `assignment` (+ `customer-confirm`)  
2) `payment` (create intent + mark paid + demo take payment)  
3) `past-due`  
4) `language` + `membership` + `notes` + `reset` + `kiosk-ack`  
5) `agreement` (largest/highest risk; do last)

Reasoning: agreement touches the most tables + PDFs + inventory and is easiest to break accidentally. Everything before it mainly updates lane session/payment state and broadcasts.

## Implementation pattern to follow

For each new handler module:
- Create `services/api/src/checkin/handlers/<name>.ts`
- Export `registerCheckin<Name>Routes(fastify: FastifyInstance): Promise<void>`
- Move the route definitions unchanged (same URL, schema, auth, replies, broadcasts, errors)
- In `services/api/src/checkin/handlers/index.ts`, export the new registrar
- In `services/api/src/routes/checkin.ts`, replace the inline routes with `await registerCheckin<Name>Routes(fastify)`

Keep imports clean:
- Prefer importing shared helpers/types from `../checkin/service.js` and `../checkin/types.js`
- Avoid deep imports from `@club-ops/shared` internals; use package entrypoints.

## Verification (must pass before declaring done)

From repo root:
- `pnpm --filter @club-ops/api typecheck`
- `pnpm --filter @club-ops/api test`
- `pnpm --filter @club-ops/api lint` (or repo-wide `pnpm lint` if required by CI)

Also sanity-check basic runtime by starting dev (`pnpm dev`) and exercising at least:
- Start session → scan → selection → create payment intent → mark paid → sign agreement

