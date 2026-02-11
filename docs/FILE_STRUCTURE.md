# Monorepo File Structure (Canonical Reference)

This file is the **canonical, human-maintained** map of the repository layout.

## Rules (for all contributors)

- If you **add, remove, rename, or move** any top-level area (apps/packages/services/docs/db/scripts/tools/infra), you **must** update this file in the same change.
- If you add a **new app/package/service** (or a new major sub-area under an existing one), you **must** add it here with a 1–2 line description.
- Keep this doc **stable and skim-friendly**:
  - Do **not** list `node_modules/`, `dist/`, build artifacts, or generated files.
  - Prefer describing “what lives here” over enumerating every file.

## Top-level layout

```
agents.md                  # Agent CI/deploy rules + code-writing docs index
CONTRIBUTING.md            # Engineering guide (scope, non-negotiables, quality gates)
SPEC.md                    # Business invariants + pointers (keep short)
openapi.yaml               # API contract (source of truth)
db/                        # Schema snapshot + database assets
docs/                      # Human docs (specs, database meaning, QA, demos)
apps/                      # Frontend kiosk/dashboard apps (Vite/React)
packages/                  # Shared libraries used across apps/services
services/                  # Backend services (API, jobs, etc.)
scripts/                   # Repo automation/dev scripts
tools/                     # One-off tooling (e.g., RAG utilities)
infra/                     # Deployment/infra config
artifacts/                 # Non-source artifacts (e.g., generated reports)

# Docker Configuration
.dockerignore              # Files excluded from Docker builds
DOCKER.md                  # Docker setup guide and best practices
docker-compose.yml         # Production container orchestration
docker-compose.dev.yml     # Development overrides with hot-reload
docker.sh                  # Helper script for Docker operations
Dockerfile.api             # API service image definition
Dockerfile.customer-kiosk  # Customer kiosk image definition
Dockerfile.employee-register # Employee register image definition
Dockerfile.office-dashboard  # Office dashboard image definition
.env.example               # Environment variable template

# CI/CD Pipelines
.github/workflows/
  ci-enhanced.yml          # CI pipeline: build, typecheck, lint, Docker validation, Dockerfile lint, security scan
  deploy.yml               # Demo deployment: auto-deploys on push to main
  deploy-production.yml    # Production deployment: triggered by git tags (v*)
  rollback.yml             # Emergency rollback: manual dispatch to revert to previous version
  seed-demo.yml            # Demo database seeding workflow
  docker-image-scan.yml    # Scheduled/manual Docker image vulnerability scanning
  docker-multi-arch.yml    # Manual/scheduled multi-arch Docker build + push
  deploy-frontends.yml     # Frontend-only deployment workflow
```

## apps/

Customer- and staff-facing UIs (generally Vite + React).

```
apps/
  customer-kiosk/          # Customer-facing kiosk UI
  employee-register/       # Staff register UI (sign-in, register workflows; state slices + value helpers under src/app/state)
  office-dashboard/        # Admin/office dashboard UI
```

Notable sub-areas:

```
apps/employee-register/src/
  components/register/employee-assist/   # Employee assist step UIs
  components/register/panels/active-visit/ # Active-visit switch-room/locker flow helpers
  components/register/manual-checkout/   # Shared manual checkout UI (panel + modal)
  components/register/required-tender/   # Required tender split payment UI
  inventory/                             # Inventory drawer components + data hooks
```

## packages/

Shared TypeScript packages consumed by multiple apps/services.

```
packages/
  shared/                  # Shared types, realtime schemas, domain helpers used across repo
  ui/                      # Shared UI primitives/styles used by apps
  app-kit/                 # App scaffolding/utilities (build/runtime helpers)
```

## services/

Backend runtime(s).

```
services/
  api/                     # Main API service (HTTP + realtime/websocket)
    src/routes/checkin/switch-resource.ts # Check-in route to switch assigned room/locker
```

## docs/

Long-form docs and specs. Keep `SPEC.md` as an index and put details here.

```
docs/
  database/                # DB meaning + entity details (source of truth for semantics)
  specs/                   # Feature specs (long-form); link from SPEC.md as needed
  demo/                    # Demo/smoke-test notes and reports
  DEPLOYMENT.md            # Complete deployment documentation (AWS, CI/CD, monitoring)
  DEPLOYMENT_QUICKREF.md   # Quick reference for common deployment commands
  DEPLOYMENT_CHECKLIST.md  # Step-by-step checklists for deployments and operations
  deployment-pipeline-diagram.md  # Visual diagrams of CI/CD pipelines and AWS architecture
```
