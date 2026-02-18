# AWS Architecture Reference (Deprecated)

> **Status**: DEPRECATED as of 2026-02-18. All AWS services have been deactivated to save costs.
> This document preserves the architecture for future re-activation.

## Overview

The application used three AWS services for cloud functionality:

1. **AWS AppSync Events** — realtime pub/sub for pushing state changes to connected clients
2. **AWS CloudWatch** — custom business metrics (check-ins, checkouts, payments, errors)
3. **AWS ECR + ECS** — container hosting for the API and frontend apps (via GitHub Actions CI/CD)

## 1. AppSync Events (Realtime)

### How It Worked

```
┌─────────────┐    REST     ┌──────────┐   Publish   ┌───────────────┐
│ Employee    │ ───────────→│ API      │ ──────────→ │ AppSync Events│
│ Kiosk       │             │ Server   │             │ (pub/sub)     │
│             │←────────────│          │←────────────│               │
│             │  WebSocket  │          │  Subscribe  │               │
└─────────────┘             └──────────┘             └───────────────┘
```

- **API publishes** events via SigV4-signed HTTP POST to AppSync Events API
- **Clients subscribe** via WebSocket (wss://) using SigV4 auth headers
- **Auth flow**: Client calls `POST /v1/realtime/auth` → API signs with AWS IAM → returns connection headers + subscription headers → client opens WebSocket

### AWS Resources

| Resource | Name | API ID | Region |
|----------|------|--------|--------|
| Events API (dev) | `club-ops-events-dev` | `ayvut7mkmbcm7f34zdxrrtn6yy` | us-east-1 |
| Events API (prod) | `club-ops-events-prod` | `3mzj6xmahngqbpuk77t7mwzfja` | us-east-1 |
| Events API (dev alt) | `clubops-realtime-dev` | `4kohgriqrvaj5lg7lwe5ftzjs4` | us-east-1 |
| Events API (prod alt) | `clubops-realtime-prod` | `3sgb4vx6hvemhil2httqutuswy` | us-east-1 |

### Endpoints

- **Dev HTTP**: `https://yqg4r3pkvvhzvnultnequus77y.appsync-api.us-east-1.amazonaws.com/event`
- **Dev Realtime**: `wss://yqg4r3pkvvhzvnultnequus77y.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime`

### Env Vars

- `APPSYNC_EVENTS_HTTP_ENDPOINT` — HTTP endpoint for publishing events
- `APPSYNC_EVENTS_CHANNEL_NAMESPACE` — Channel namespace prefix (default: `club-ops`)
- `AWS_REGION` / `AWS_DEFAULT_REGION` — Region for SigV4 signing

### Key Files (preserved but deprecated)

| File | Purpose |
|------|---------|
| `services/api/src/realtime/appsyncEvents.ts` | SigV4 signing, channel validation, event publishing |
| `services/api/src/realtime/broadcaster.ts` | Event dispatcher (AppSync + local WebSocket) |
| `services/api/src/routes/realtime.ts` | `/v1/realtime/auth` endpoint — signs AppSync auth |
| `packages/shared/realtime/transports/appsync.ts` | Client-side AppSync WebSocket transport |
| `packages/shared/realtime/transports/hybrid.ts` | Hybrid transport (AppSync primary, LAN fallback) |
| `packages/shared/realtime/useLaneSession.ts` | React hook wrapping the transport layer |

### Channel Structure

- `/club-ops/global` — Global events (room status, inventory, register sessions)
- `/club-ops/lane/{laneId}` — Lane-scoped events (session updates, checkout flow)

### Event Types

`ROOM_STATUS_CHANGED`, `INVENTORY_UPDATED`, `ROOM_ASSIGNED`, `ROOM_RELEASED`,
`SESSION_UPDATED`, `CHECKOUT_REQUESTED`, `CHECKOUT_CLAIMED`, `CHECKOUT_UPDATED`,
`CHECKOUT_COMPLETED`, `CUSTOMER_CONFIRMATION_REQUIRED`, `CUSTOMER_CONFIRMED`,
`CUSTOMER_DECLINED`, `SELECTION_FORCED`, `ASSIGNMENT_CREATED`, `ASSIGNMENT_FAILED`,
`REGISTER_SESSION_UPDATED`

---

## 2. CloudWatch Metrics

### How It Worked

- API published custom metrics to CloudWatch namespace `ClubOperations`
- Only active when `AWS_REGION` was set; no-op in local dev
- Fire-and-forget pattern — never blocks business logic

### Key File

`services/api/src/services/cloudMetrics.ts`

### Metrics Published

| Metric | Unit | Dimensions |
|--------|------|------------|
| `CheckInCount` | Count | RegisterId |
| `CheckOutCount` | Count | — |
| `PaymentCount` | Count | PaymentMethod |
| `RevenueAmount` | None | PaymentMethod |
| `OverrideCount` | Count | Action |
| `OccupancyRate` | Percent | — |
| `StaffClockInCount` | Count | — |
| `ApiErrorCount` | Count | Endpoint |

---

## 3. CI/CD (GitHub Actions → ECR → ECS)

### Deployment Flow

```
Push to branch → GitHub Actions → Build Docker image → Push to ECR → Deploy to ECS
```

### Key Files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | Dev deployment (builds + pushes to ECR, deploys to ECS) |
| `.github/workflows/deploy-prod.yml` | Production deployment |
| `.github/workflows/build.yml` | CI build + test pipeline |

### Required GitHub Secrets

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — IAM credentials
- `APPSYNC_EVENTS_HTTP_ENDPOINT` — AppSync dev endpoint
- `APPSYNC_EVENTS_HTTP_ENDPOINT_PROD` — AppSync prod endpoint
- `KIOSK_TOKEN` — Kiosk authentication token

---

## 4. Edge Server (LAN Fallback)

### How It Worked

- Docker Compose stack (`docker-compose.edge.yml`) running API + Postgres at the venue
- Separate database on port 5434 with password `club-ops-edge`
- WebSocket fallback via `LAN_FALLBACK=true` env var
- Client transport (`HybridTransport`) tried AppSync first, fell back to LAN WebSocket

### Key Files

| File | Purpose |
|------|---------|
| `docker-compose.edge.yml` | Edge server stack definition |
| `Dockerfile.api` | API container image |
| `packages/shared/realtime/transports/lan.ts` | LAN WebSocket transport |
| `services/api/src/realtime/localSockets.ts` | Server-side LAN WebSocket handler |

---

## Re-activation Steps

To restore AWS services in the future:

1. **AppSync**: Re-create Event APIs or reactivate existing ones in AWS console
2. **Set env vars**: `APPSYNC_EVENTS_HTTP_ENDPOINT`, `AWS_REGION`
3. **Uncomment** the AppSync transport in `useLaneSession.ts`
4. **Uncomment** the AppSync publish calls in `broadcaster.ts`
5. **Restore** GitHub Actions secrets and deployment workflows
6. **Uncomment** CloudWatch client initialization in `cloudMetrics.ts`
7. **Restore** edge server docker-compose configuration
