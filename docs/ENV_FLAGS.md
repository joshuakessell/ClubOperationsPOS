# Environment Flags

This document lists non-secret environment variables used as feature flags.

> Note: `.env.example` is currently gitignored in this repo, so this file is the tracked source
> of truth for feature-flag documentation.

## API

- `FLOW_COMMANDS` (default: `false`)
  - Enables `POST /v1/checkin/lane/:laneId/flow-command`.
  - When enabled, some legacy endpoints may also increment `lane_sessions.flow_version` to keep
    the lock-step flow state machine consistent.

