# Debug Runbook: Realtime Lane Sync (Lock-Step v2)

This runbook helps diagnose cases where the kiosk/register UI is not updating or appears out of sync.

## Mental model

For a given lane, the client should receive realtime events on a per-lane channel and apply them **monotonically**
using `flowVersion`.

### Realtime transports

- **Cloud mode**: AppSync Events transport (WebSocket).
- **LAN mode**: Edge API local WebSocket (`/v1/realtime/lan/lane/:laneId`).

In v2, the apps use the transport abstraction by default. You can force legacy behavior by setting
`VITE_REALTIME_TRANSPORTS=0`.

## Quick checks (10 minutes)

1) Confirm the lane is correct
- Kiosk: verify the lane in the URL / lane picker.
- Employee-register: verify the displayed lane.

2) Confirm API health
- Cloud: `GET {VITE_API_BASE_URL}/health` should return 200.
- LAN edge (if configured): `GET {VITE_LAN_API_BASE_URL}/health` should return 200.

3) Confirm realtime connection
- In dev builds, employee-register shows a banner when in **LAN mode**.
- In dev tools / console logs, look for realtime connect/disconnect messages when `VITE_REALTIME_DEBUG=yes`.

4) Check that events are publishing
- If the lane session is changing in the database but UIs are not updating, suspect broadcast / subscription.
- If one UI updates but the other does not, suspect per-app auth headers or channel subscription.

## Deep checks

### A) Validate auth / credentials

Cloud auth:
- Kiosk uses `x-kiosk-token`.
- Employee-register uses `Authorization: Bearer {staffToken}` (and may also provide kiosk token depending on config).

LAN auth:
- Kiosk uses `x-kiosk-token` against the edge API.
- Employee-register requires staff auth; if staff token validation is not available offline, treat edge as kiosk-only.

If you suspect auth:
- Reproduce with a single app (kiosk only), then add employee-register.
- Inspect the API logs for 401/403 around `/api/v1/realtime/auth` (cloud) or `/v1/realtime/lan/*` (LAN).

### B) Validate channel namespace

Ensure all parties use the same `VITE_REALTIME_CHANNEL_NAMESPACE` (default: `club-ops`).

If the namespace differs, apps can connect but never receive lane events.

### C) Validate monotonic ordering behavior

Symptoms:
- UI “stuck” after a burst of events.
- Register and kiosk disagree on step.

Checks:
- Inspect event payloads for `flowVersion` and confirm the UI is applying only increasing versions.
- Confirm the API broadcaster is not emitting stale `flowVersion` (it should drop stale versions).

### D) Validate LAN websocket routing

Checks:
- Confirm edge API has `LAN_FALLBACK=true`.
- Confirm per-lane flag `lan_realtime_enabled` is true (or null with global enabled).
- Confirm the client has:
  - `VITE_LAN_FALLBACK=1`
  - `VITE_LAN_REALTIME_WS_URL` set (ws/wss)
  - `VITE_LAN_API_BASE_URL` set (http/https)

## Common fixes

### Force cloud mode (frontend)
- Set `VITE_LAN_FALLBACK=0` (and redeploy kiosk/register).

### Force legacy websocket (frontend)
- Set `VITE_REALTIME_TRANSPORTS=0` (and redeploy).

### Disable v2 behavior (API + apps)
- API env:
  - `LOCKSTEP_V2=false`
  - `FLOW_COMMANDS=false`
  - `LAN_FALLBACK=false`
- App build env:
  - `VITE_LOCKSTEP_V2=0`
  - `VITE_FLOW_COMMANDS=0`
  - `VITE_LAN_FALLBACK=0`

### Narrow blast radius (per-lane)
- Use `lane_feature_flags` overrides for the impacted lane(s) only.

