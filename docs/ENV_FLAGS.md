# Environment Flags

This document lists non-secret environment variables used as feature flags.

> Note: `.env.example` is currently gitignored in this repo, so this file is the tracked source
> of truth for feature-flag documentation.

## API

- `FLOW_COMMANDS` (default: `false`)
  - Enables `POST /v1/checkin/lane/:laneId/flow-command`.
  - When enabled, some legacy endpoints may also increment `lane_sessions.flow_version` to keep
    the lock-step flow state machine consistent.

- `LAN_FALLBACK` (default: `false`)
  - Enables the LAN websocket endpoint: `GET /v1/realtime/lan/lane/:laneId`.
  - When enabled, the API will dual-publish lane-scoped realtime events to both AppSync and connected
    LAN websocket clients.

## Frontend

- `VITE_REALTIME_TRANSPORTS` (default: `0`)
  - Enables the experimental realtime transport abstraction in `@club-ops/shared/realtime/useLaneSession`.
  - When `0`, the apps use the legacy in-hook AppSync websocket implementation.

- `VITE_LAN_REALTIME_WS_URL` (default: unset)
  - When set and `VITE_REALTIME_TRANSPORTS=1`, adds an additional LAN websocket transport to the hybrid transport.
  - Currently scaffold-only; intended for the LAN fallback phase of Lock-Step v2.
