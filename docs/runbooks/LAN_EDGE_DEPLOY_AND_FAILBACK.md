# Runbook: LAN Edge Deploy + Failback (Lock-Step v2)

This runbook covers how to bring up the LAN edge stack for local operations and how to fail back to cloud safely.

## When to use LAN edge

Use LAN edge when:
- Cloud connectivity is unstable or unavailable.
- You need lane operations to continue using local Postgres + local realtime websocket.

The edge stack is intended to be authoritative for lanes it serves while in LAN mode.

## Preconditions

- Edge host has Docker available.
- You have the kiosk token for LAN auth (`KIOSK_TOKEN`).
- You have a plan for staff auth (employee-register may be cloud-only if staff tokens cannot be validated offline).

## Deploy: Local edge stack

From repo root:

```bash
docker compose -f docker-compose.edge.yml up -d
docker compose -f docker-compose.edge.yml ps
docker compose -f docker-compose.edge.yml logs -f api
```

Health checks:
- API: `GET http://localhost:3001/health`
- LAN websocket endpoint should accept connections at `/v1/realtime/lan/lane/:laneId` (ws)

## Configure clients to use edge

### customer-kiosk

Build-time env:
- `VITE_LAN_FALLBACK=1`
- `VITE_LAN_API_BASE_URL=http://{edge-host}:3001`
- `VITE_LAN_REALTIME_WS_URL=ws://{edge-host}:3001/v1/realtime/lan/lane/{LANE_ID}`

The kiosk will automatically switch to LAN mode when cloud health fails (hysteresis) and the LAN health is good.

### employee-register

Employee-register also supports LAN mode, but staff auth may be cloud-only depending on your auth setup.

Build-time env:
- `VITE_LAN_FALLBACK=1`
- `VITE_LAN_API_BASE_URL=http://{edge-host}:3001`
- `VITE_LAN_REALTIME_WS_URL=ws://{edge-host}:3001/v1/realtime/lan/lane/{LANE_ID}`

In dev builds, employee-register shows a banner when it is running in LAN mode.

## Verify LAN operation

- Confirm clients show normal lane flow updates.
- Confirm writes succeed via edge API.
- Confirm realtime updates are being received via LAN websocket.

## Failback: Edge -> Cloud

### 1) Confirm cloud is healthy

- `GET {VITE_API_BASE_URL}/health` returns 200.
- AppSync Events transport can connect (check client logs with `VITE_REALTIME_DEBUG=yes`).

### 2) Allow clients to switch back

Clients will fail back automatically when cloud health is consistently good (hysteresis).

If you need to force cloud mode quickly:
- Redeploy frontends with `VITE_LAN_FALLBACK=0`.

### 3) Replay offline outbox

If the edge accepted commands in LAN mode, replay them to cloud in order.

```bash
CLOUD_API_BASE_URL="https://api-demo.joshuakessell.com/api" \
DATABASE_URL="postgres://..." \
KIOSK_TOKEN="..." \
pnpm --filter @club-ops/api offline:replay
```

Expected outcome:
- Pending `offline_command_outbox` rows get `replayed_at` set.
- Conflicts (version mismatch / invalid transition) are recorded in `last_replay_error` and must be resolved manually.

### 4) (Optional) Disable edge temporarily

```bash
docker compose -f docker-compose.edge.yml down
```

## Emergency controls

### Disable LAN fallback globally (API)
- Set `LAN_FALLBACK=false` in App Runner env.

### Disable LAN fallback in clients
- Set `VITE_LAN_FALLBACK=0` and redeploy.

### Narrow blast radius per lane
- Use `lane_feature_flags` overrides to disable `lan_fallback_enabled` or `lan_realtime_enabled` for specific lanes.

