# Environment Flags

This document lists non-secret environment variables used as feature flags.

> Note: `.env.example` is currently gitignored in this repo, so this file is the tracked source
> of truth for feature-flag documentation.

## API

- `LOCKSTEP_V2` (default: `false`)
  - Master flag for the Lock-Step Check-In v2 rollout.
  - When enabled, the API may prefer the v2 flow engine / dual-transport behaviors when available.
  - This flag is intended to gate broader behavior than `FLOW_COMMANDS` so we can roll out incrementally.

- `FLOW_COMMANDS` (default: `false`)
  - Enables `POST /v1/checkin/lane/:laneId/flow-command`.
  - When enabled, some legacy endpoints may also increment `lane_sessions.flow_version` to keep
    the lock-step flow state machine consistent.

- `LAN_FALLBACK` (default: `false`)
  - Enables the LAN websocket endpoint: `GET /v1/realtime/lan/lane/:laneId`.
  - When enabled, the API will dual-publish lane-scoped realtime events to both AppSync and connected
    LAN websocket clients.

- `LAN_AUTHORITATIVE` (default: `false`)
  - Enforces “edge is authoritative” behavior when LAN fallback is active.
  - Intended for edge/LAN deployments where the edge API should reject non-authoritative writes.
  - Can be overridden per lane via `lane_feature_flags.lan_authoritative_enabled`.

- `EDGE_STACK` (default: `false`)
  - Identifies that this API instance is running as the on-prem edge stack.
  - Used with `LAN_AUTHORITATIVE=true` to decide whether writes should be accepted.

- Per-lane overrides (table: `lane_feature_flags`)
  - `lockstep_v2_enabled`, `flow_commands_enabled`, `lan_fallback_enabled`, `lan_authoritative_enabled`
  - When set (non-null), these override the corresponding global env flags for that lane.

## Frontend

- `VITE_LOCKSTEP_V2` (default: `0`)
  - Master flag for Lock-Step Check-In v2 app behavior.
  - When `1`, the apps may prefer v2 state derivation and transports when available.

- `VITE_FLOW_COMMANDS` (default: `0`)
  - When `1`, enables sending step-navigation flow commands (`BACK_STEP` / `CANCEL_STEP`) from the apps.
  - Requires API `FLOW_COMMANDS=true`.

- `VITE_REALTIME_TRANSPORTS` (default: `1`)
  - Enables the realtime transport abstraction in `@club-ops/shared/realtime/useLaneSession`.
  - When `0`, the apps use the legacy in-hook AppSync websocket implementation.

- `VITE_LAN_REALTIME_WS_URL` (default: unset)
  - When set and `VITE_REALTIME_TRANSPORTS=1`, adds an additional LAN websocket transport to the hybrid transport.
  - Currently scaffold-only; intended for the LAN fallback phase of Lock-Step v2.

- `VITE_LAN_FALLBACK` (default: `0`)
  - When `1`, enables LAN fallback behavior in the apps (when supported).
  - Intended to be used alongside `VITE_REALTIME_TRANSPORTS=1` and `VITE_LAN_REALTIME_WS_URL`.

- `VITE_LAN_API_BASE_URL` (default: unset)
  - Base URL for the on-prem edge API used for LAN fallback health checks.
  - Example: `http://localhost:3000`
