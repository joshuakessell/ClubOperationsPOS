## Lock-Step Check-In v2 + Dual-Transport Resilience (Cloud + LAN) Plan

### Summary
- Build a **single authoritative check-in flow state machine** so `customer-demo` and `employee-demo` stay in strict lock-step.
- Keep **AppSync Events** as cloud realtime transport.
- Add **LAN-authoritative fallback** (local edge API + local WebSocket + local Postgres) for internet outages.
- Make all shared check-in actions **idempotent** with command IDs + version checks.
- Ship behind **per-lane feature flags** for safe demo rollout and instant rollback.
- Include **AWS MCP setup now** for faster AWS diagnostics/operations.

---

### Product/Behavior Contract (Decision-Complete)
- Shared flow steps: `RENTAL -> WAITLIST_PREFERENCES -> WAITLIST_BACKUP -> PAYMENT -> AGREEMENT -> COMPLETE`.
  - Language defaults to English; customers can toggle to Spanish via an on-screen button (no dedicated flow step).
- Employee shared buttons behavior:
  - First tap on shared option: highlight/propose for customer.
  - Second tap same option: confirm/force selection.
- Back/cancel behavior:
  - If either app navigates back, the other app mirrors same step immediately.
  - Selections made on exited step are cleared server-side (not just hidden client-side).
- Waitlist sync:
  - Desired-type checkboxes + specific room/locker selection mirror both directions immediately.
  - Back/cancel clears exactly the scope being exited.
- Conflict policy: **single authoritative state machine** with ordered versioning (no client-side last-write-wins).

---

### Public API / Type / Interface Changes
- Add to `SessionUpdatedPayload` (shared package):
  - `flowStep`, `flowVersion`, `flowLastActor`, `flowLastCommandId`.
- Add new command API:
  - `POST /v1/checkin/lane/:laneId/flow-command`
  - Request includes: `sessionId`, `commandId (UUID)`, `actor`, `expectedFlowVersion`, `type`, `payload`.
  - Response includes: `applied`, `deduped`, `flowVersion`, `session`.
- Keep legacy endpoints; route them through same command engine while feature flag is enabled.
- Add DB support:
  - `lane_sessions`: `flow_step`, `flow_version`, `flow_last_command_id`, `flow_last_actor`.
  - `lane_session_commands`: dedupe/audit table keyed by `(session_id, command_id)`.
  - `offline_command_outbox`: ordered replay queue for LAN mode.

---

### Backend Implementation Plan
1. Add feature flags (`LOCKSTEP_V2`, `LAN_FALLBACK`, `FLOW_COMMANDS`) and wire defaults off.
2. Implement centralized flow-command handler with:
   - row lock (`FOR UPDATE`),
   - version guard (`expectedFlowVersion`),
   - command dedupe (`commandId`),
   - deterministic transition rules,
   - transition-specific state clearing.
3. Emit `SESSION_UPDATED` after every accepted command; include new flow metadata.
4. Add local realtime server endpoint (WebSocket) in API and make broadcaster publish to:
   - AppSync lane channel (cloud),
   - local lane sockets (LAN mode).
5. Add outbox writer for LAN mode and replay worker for reconnect reconciliation.

---

### Frontend Implementation Plan
- `packages/shared/realtime`:
  - Introduce transport abstraction (`AppSyncTransport`, `LanWebSocketTransport`, `HybridTransport`).
- `customer-kiosk`:
  - Render step from `flowStep` (not inferred heuristics).
  - Send `BACK_STEP` / `CANCEL_STEP` commands on modal back/cancel.
  - Apply only monotonic `flowVersion` updates.
- `employee-register`:
  - Derive Employee Assist step from `flowStep`.
  - First-click/second-click logic backed by flow commands + versions.
  - Mirror kiosk availability ordering and hide unavailable options per shared contract.
  - Keep employee-only actions (`Clear Session`, `Add 6-Month Membership`) out of customer shared surface.

---

### LAN Fallback Architecture
- Runtime mode switch: auto health-based with hysteresis (cloud down -> LAN, stable cloud -> failback).
- Local edge host: **Docker Compose** with API + Postgres + local websocket.
- Offline auth: local JWT/session + kiosk token checks preserved.
- Reconciliation: replay ordered outbox commands with same `commandId`/version semantics.

---

### AWS MCP Setup (Included in this update)
- Configure AWS MCP Server via `uvx mcp-proxy-for-aws@latest` against `https://aws-mcp.us-east-1.api.aws/mcp` in Codex MCP config.
- Use AWS CLI login/profile and IAM policy for AWS MCP actions.
- Verify tools load and use for:
  - App Runner status/log triage,
  - AppSync endpoint/config checks,
  - DNS/CloudFront/App Runner diagnostics.
- Start with read-only operational workflows, then enable write workflows intentionally.

---

### Test Cases & Acceptance Scenarios
- API transition tests: every command, back/cancel clearing, invalid transition rejection.
- Idempotency tests: duplicate `commandId` returns deduped same result, no duplicate side effects.
- Realtime ordering tests: stale version ignored; latest version wins.
- Cross-app sync tests:
  - employee first/second tap behavior,
  - customer back navigation mirrors employee,
  - waitlist checkbox/specific-number sync both directions.
- Failover tests:
  - cloud disconnect -> LAN mode continuity,
  - reconnect -> replay and converge with no duplicate ledger lines.
- Demo acceptance:
  - scan/search/manual start opens synchronized session immediately,
  - no “waiting for lane session” dead state after first successful start,
  - strict lock-step preserved through back/cancel.

---

### Assumptions / Defaults Chosen
- Delivery strategy: **Phased hardening**.
- Offline topology: **single local edge host**.
- Conflict rule: **server-ordered commands with versioning**.
- Pairing model: **session ID + lease**.
- Reconciliation: **command outbox replay**.
- UX strictness: **strict gate lock-step**.
- Failover: **automatic health-based switch**.
- Local datastore: **local Postgres mirror schema**.
- Offline auth: **local JWT + kiosk token**.
- Rollout: **feature flags by lane**.
- MCP timing: **include now**.

---

### AWS references used
- AppSync Events websocket/event protocol: https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
- AppSync private API constraints (VPC-only): https://docs.aws.amazon.com/appsync/latest/devguide/using-private-apis.html
- AWS MCP overview: https://docs.aws.amazon.com/aws-mcp/latest/userguide/what-is-mcp-server.html
- AWS MCP setup: https://docs.aws.amazon.com/aws-mcp/latest/userguide/getting-started-aws-mcp-server.html
- AWS MCP tools: https://docs.aws.amazon.com/aws-mcp/latest/userguide/understanding-mcp-server-tools.html
- Greengrass local pub/sub (edge-local messaging option): https://docs.aws.amazon.com/greengrass/v2/developerguide/ipc-publish-subscribe.html

