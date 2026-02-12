# Lock-Step Check-In v2 Execution Plan (Backlog)

This file converts `docs/PLAN.md` into an executable checklist so we can count remaining work.

Legend:
- [x] Done
- [ ] Not started / in progress

## 0) Already Completed

- [x] Add flow fields to `lane_sessions` + `lane_session_commands` dedupe table (`services/api/migrations/...flow_fields_and_command_dedupe.sql`)
- [x] Add `/v1/checkin/lane/:laneId/flow-command` endpoint (idempotent + version guard)
- [x] Emit `SESSION_UPDATED` with `flowStep/flowVersion/flowLastActor/flowLastCommandId`
- [x] Ignore stale `SESSION_UPDATED` by `flowVersion` (kiosk + employee)
- [x] Add realtime transport abstraction scaffolding + HybridTransport tests
- [x] AppSyncTransport parity + reconnect/backoff + unit tests

## 1) Feature Flags + Rollout Controls

- [ ] Add `LOCKSTEP_V2` flag plumbing (API + apps)
- [ ] Add `LAN_FALLBACK` flag plumbing (API + apps)
- [x] Add `FLOW_COMMANDS` flag (API)
- [ ] Add per-lane flag overrides (server-side lane config)
- [ ] Add a rollback playbook entry in `docs/DEPLOYMENT.md`

## 2) Backend: Authoritative Flow Command Engine (Hardening)

- [x] Define canonical transition table for steps (allowed transitions)
- [ ] Implement transition-specific clearing rules for each step:
  - [x] LANGUAGE
  - [x] RENTAL
  - [x] WAITLIST_PREFERENCES
  - [x] WAITLIST_BACKUP
  - [x] PAYMENT
  - [x] AGREEMENT
  - [x] COMPLETE
- [ ] Add command types beyond step navigation (as needed):
  - [ ] PROPOSE_SELECTION
  - [ ] FORCE_SELECTION
  - [ ] ACK_SELECTION
  - [ ] WAITLIST_PREFERENCES_UPDATE
  - [ ] WAITLIST_BACKUP_SET
- [ ] Ensure *all* commands are idempotent + version guarded
- [x] Add audit payload shape + strict schema validation

## 3) Backend: Route Legacy Endpoints Through Command Engine

- [x] `set-language` increments flow_version when FLOW_COMMANDS enabled
- [ ] Route `selection` endpoints through command engine (propose/force/lock)
- [ ] Route waitlist preference + backup endpoints through command engine
- [x] Route payment-intent creation/updates through command engine (step bump + audit)
- [x] Route agreement signing/bypass through command engine (step bump + audit)
- [ ] Route back/cancel actions from both apps through command engine
  - [x] customer-kiosk (behind `VITE_FLOW_COMMANDS`)
  - [x] employee-register (behind `VITE_FLOW_COMMANDS`)

## 4) Backend: Realtime Dual-Publish (Cloud + LAN)

- [x] Add local websocket server endpoint to API for LAN mode
- [x] Add local lane channel routing semantics (match AppSync channels)
- [x] Update broadcaster to publish to AppSync + local sockets
- [ ] Add ordering guarantees / monotonic version enforcement in broadcaster

## 5) LAN Fallback: Edge Stack + Local DB

- [ ] Add edge docker-compose stack (API + Postgres + LAN websocket)
- [ ] Add `LAN_FALLBACK` health detection + hysteresis (cloud->LAN, LAN->cloud)
- [ ] Define offline auth behavior (kiosk token, staff tokens)
- [ ] Add local “lane ownership” / authority rules

## 6) Offline Outbox + Reconciliation

- [ ] Add `offline_command_outbox` table
- [ ] Write outbox records for LAN-mode accepted commands
- [ ] Replay worker on reconnect (ordered, idempotent)
- [ ] Conflict handling for diverged versions
- [ ] Observability: logs/metrics for replay lag + failures

## 7) Frontend: Render by `flowStep` (No Heuristics)

### customer-kiosk

- [ ] Drive view routing off `SessionUpdatedPayload.flowStep`
- [ ] Send `BACK_STEP` / `CANCEL_STEP` flow commands on back/cancel UI
- [ ] Ensure monotonic flowVersion updates everywhere (already in reducer, verify all paths)
- [ ] Remove heuristic fallbacks once stable

### employee-register

- [ ] Drive Employee Assist step off `flowStep`
- [ ] Implement first-click highlight / second-click confirm backed by commands
- [ ] Mirror kiosk ordering + hide unavailable options

## 8) Frontend: Hybrid Transport + Mode Switch

- [ ] Finish porting legacy `useLaneSession` to use transports by default (remove legacy socket path)
- [x] Implement `LanWebSocketTransport` protocol (match server LAN WS)
- [x] Implement `HybridTransport` selection logic (cloud preferred, LAN fallback)
- [ ] Add health-based mode switch plumbing in apps

## 9) Tests + Acceptance

- [ ] API transition tests for each command type
- [x] API idempotency/version tests for flow-command
- [x] LAN websocket integration test (auth rejection)
- [ ] Realtime ordering tests (stale ignored) end-to-end
- [ ] Cross-app lock-step acceptance tests
- [ ] Failover tests: cloud disconnect -> LAN -> reconnect

## 10) Docs + Ops

- [x] Document env flags in `docs/ENV_FLAGS.md`
- [ ] Update `docs/DEPLOYMENT.md` with rollout + rollback steps
- [ ] Add runbook: debug realtime lane sync
- [ ] Add runbook: LAN edge deploy + failback

---

## Counts

- Total checklist items: 72
- Completed checklist items: 30
- Remaining checklist items: 42
