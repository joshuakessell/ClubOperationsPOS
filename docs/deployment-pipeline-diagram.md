# Deployment Pipeline Architecture

## Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      CODE CHANGES                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├──────────────────┬─────────────────┐
                              ↓                  ↓                 ↓
                    ┌─────────────────┐  ┌─────────────┐  ┌─────────────┐
                    │   Pull Request  │  │ Push to main│  │  Git Tag v* │
                    │                 │  │             │  │             │
                    │   CI Pipeline   │  │ Demo Deploy │  │ Prod Deploy │
                    └─────────────────┘  └─────────────┘  └─────────────┘
```

## CI Pipeline (ci-enhanced.yml)

Triggered on: **Pull Request** | **Push to main**

```
┌─────────────────────────────────────────────────────────────────┐
│                        VALIDATE                                  │
├─────────────────────────────────────────────────────────────────┤
│ • Setup Node 22 + pnpm 10.28.0                                  │
│ • Install dependencies (with cache)                              │
│ • pnpm turbo run build                                          │
│ • pnpm turbo run typecheck                                      │
│ • pnpm turbo run lint                                           │
│ • pnpm spec:check                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   DOCKER VALIDATE (Matrix)                       │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│ │     API     │ │ Cust. Kiosk │ │  Employee   │ │  Dashboard ││
│ │             │ │             │ │  Register   │ │            ││
│ │ Build Docker│ │ Build Docker│ │ Build Docker│ │Build Docker││
│ │   Image     │ │   Image     │ │   Image     │ │  Image     ││
│ │ (Dockerfile.│ │ (Dockerfile.│ │ (Dockerfile.│ │(Dockerfile.││
│ │    api)     │ │ customer-   │ │ employee-   │ │ office-    ││
│ │             │ │  kiosk)     │ │  register)  │ │ dashboard) ││
│ └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│                                                                  │
│ All builds use BuildKit cache (GitHub Actions cache)            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              DOCKER COMPOSE INTEGRATION TEST                     │
├─────────────────────────────────────────────────────────────────┤
│ • Create .env with test credentials                             │
│ • docker compose build --parallel                               │
│ • docker compose up -d                                          │
│ • Wait for API health check                                     │
│ • Test all service endpoints:                                   │
│   - API: http://localhost:3000/health                           │
│   - Customer Kiosk: http://localhost:5173/                      │
│   - Employee Register: http://localhost:5175/                   │
│ • docker compose down -v                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Demo Deployment (deploy.yml)

Triggered on: **Push to main** | **Manual dispatch**

```
┌─────────────────────────────────────────────────────────────────┐
│                   SEED DEMO DATABASE                             │
├─────────────────────────────────────────────────────────────────┤
│ • Setup Node + pnpm                                             │
│ • Configure AWS OIDC credentials                                │
│ • Install session-manager-plugin                                │
│ • Run: scripts/aws/seed-demo-via-ssm.sh                         │
│   - Creates SSM tunnel to RDS                                   │
│   - Runs demo seed script via tunnel                            │
│   - Incremental seeding (preserves existing data)               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     DEPLOY API                                   │
├─────────────────────────────────────────────────────────────────┤
│ • pnpm turbo build --filter @club-ops/shared --filter @club-   │
│   ops/api                                                       │
│ • docker build -f services/api/Dockerfile .                     │
│ • Tag with commit SHA + dev-latest                              │
│ • aws ecr get-login-password | docker login                     │
│ • docker push to ECR                                            │
│ • Skip migrations (already done in seed step)                   │
│ • aws apprunner update-service                                  │
│   - Runtime env vars: DEMO_MODE=true, LOG_LEVEL=info, etc.     │
│   - Runtime secrets: DATABASE_URL, KIOSK_TOKEN (from           │
│     Secrets Manager)                                            │
│ • Wait for App Runner status = RUNNING                          │
│                                                                 │
│ Result: https://api-demo.joshuakessell.com                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                DEPLOY EMPLOYEE REGISTER                          │
├─────────────────────────────────────────────────────────────────┤
│ • Get KIOSK_TOKEN from Secrets Manager                          │
│ • VITE_API_BASE_URL=https://api-demo.joshuakessell.com         │
│ • pnpm turbo build --filter @club-ops/employee-register         │
│ • aws s3 sync apps/employee-register/dist/ s3://BUCKET          │
│ • aws cloudfront create-invalidation                            │
│                                                                 │
│ Result: https://employee-demo.joshuakessell.com                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                DEPLOY CUSTOMER KIOSK                             │
├─────────────────────────────────────────────────────────────────┤
│ • Get KIOSK_TOKEN from Secrets Manager                          │
│ • VITE_API_BASE_URL=https://api-demo.joshuakessell.com         │
│ • pnpm turbo build --filter @club-ops/customer-kiosk            │
│ • aws s3 sync apps/customer-kiosk/dist/ s3://BUCKET             │
│ • aws cloudfront create-invalidation                            │
│                                                                 │
│ Result: https://customer-demo.joshuakessell.com                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               DEPLOYMENT SUMMARY                                 │
├─────────────────────────────────────────────────────────────────┤
│ All services deployed to demo environment:                      │
│ • API: https://api-demo.joshuakessell.com                       │
│ • Employee: https://employee-demo.joshuakessell.com             │
│ • Customer: https://customer-demo.joshuakessell.com             │
└─────────────────────────────────────────────────────────────────┘
```

## Production Deployment (deploy-production.yml)

Triggered on: **Git tag v*** | **Manual dispatch**

```
┌─────────────────────────────────────────────────────────────────┐
│                   PRE-DEPLOYMENT VALIDATION                      │
├─────────────────────────────────────────────────────────────────┤
│ • Setup Node 22 + pnpm 10.28.0                                  │
│ • Install dependencies                                          │
│ • pnpm lint (quality gate)                                      │
│ • pnpm typecheck (quality gate)                                 │
│ • pnpm spec:check (quality gate)                                │
│ • pnpm turbo run build (all packages)                           │
│                                                                 │
│ ❌ Any failure stops deployment                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     DEPLOY API                                   │
├─────────────────────────────────────────────────────────────────┤
│ • Configure AWS OIDC (AWS_ROLE_ARN_PROD)                        │
│ • pnpm install --frozen-lockfile                                │
│ • Run: scripts/aws/deploy-api.sh                                │
│   Environment:                                                  │
│   - DEMO_MODE=false (production mode)                           │
│   - SKIP_DB_MIGRATIONS=false (run migrations)                   │
│   - SKIP_DEMO_SEED=true (no demo data)                          │
│   - DB_SSL=true (secure connection)                             │
│   - LOG_LEVEL=info                                              │
│                                                                 │
│ Steps:                                                          │
│ 1. Build Docker image with commit SHA tag                       │
│ 2. Push to ECR_REPO_URI_PROD                                    │
│ 3. Run database migrations (services/api/migrations/*.sql)      │
│ 4. Verify DB schema                                             │
│ 5. Update App Runner service with new image + env vars          │
│ 6. Wait for status = RUNNING                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           DEPLOY FRONTENDS (Parallel Matrix)                     │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌──────────────────────────┐      │
│ │   Employee Register      │ │   Customer Kiosk         │      │
│ │                          │ │                          │      │
│ │ • Get KIOSK_TOKEN_PROD   │ │ • Get KIOSK_TOKEN_PROD   │      │
│ │ • VITE_API_BASE_URL_PROD │ │ • VITE_API_BASE_URL_PROD │      │
│ │ • pnpm turbo build       │ │ • pnpm turbo build       │      │
│ │ • aws s3 sync to BUCKET  │ │ • aws s3 sync to BUCKET  │      │
│ │ • CloudFront invalidate  │ │ • CloudFront invalidate  │      │
│ └──────────────────────────┘ └──────────────────────────┘      │
│                                                                 │
│ Both deploy in parallel (no dependencies)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                POST-DEPLOYMENT SMOKE TESTS                       │
├─────────────────────────────────────────────────────────────────┤
│ • Test API health: curl API_BASE_URL_PROD/health               │
│ • Test Employee Register: curl EMPLOYEE_URL_PROD (200 OK)      │
│ • Test Customer Kiosk: curl CUSTOMER_URL_PROD (200 OK)         │
│                                                                 │
│ ❌ Any failure marks deployment as failed                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 DEPLOYMENT NOTIFICATION                          │
├─────────────────────────────────────────────────────────────────┤
│ GitHub Summary:                                                 │
│ • Tag: v1.0.0                                                   │
│ • Commit: abc123...                                             │
│ • Time: 2026-02-10 12:34:56 UTC                                 │
│ • Service URLs (API, Employee, Customer)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Rollback Pipeline (rollback.yml)

Triggered on: **Manual dispatch only**

```
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATE ROLLBACK                             │
├─────────────────────────────────────────────────────────────────┤
│ Inputs required:                                                │
│ • environment: demo | production                                │
│ • git_ref: Tag or commit SHA to rollback to (e.g., v1.0.0)     │
│ • reason: Explanation for rollback                              │
│                                                                 │
│ Validation:                                                     │
│ • git rev-parse "$git_ref" (verify ref exists)                  │
│ • Create audit log in GitHub summary                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      ROLLBACK API                                │
├─────────────────────────────────────────────────────────────────┤
│ • Checkout target commit: git checkout $git_ref                 │
│ • Determine environment config (demo vs production)             │
│ • Configure AWS credentials (role based on environment)         │
│ • pnpm install --frozen-lockfile                                │
│ • Run: scripts/aws/deploy-api.sh                                │
│   - SKIP_DB_MIGRATIONS=true (avoid schema changes)              │
│   - Build Docker image from old commit                          │
│   - Push to ECR with rollback tag                               │
│   - Update App Runner service                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              ROLLBACK FRONTENDS (Parallel)                       │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌──────────────────────────┐      │
│ │   Employee Register      │ │   Customer Kiosk         │      │
│ │                          │ │                          │      │
│ │ • Checkout $git_ref      │ │ • Checkout $git_ref      │      │
│ │ • Build from old commit  │ │ • Build from old commit  │      │
│ │ • Deploy to S3           │ │ • Deploy to S3           │      │
│ │ • Invalidate CloudFront  │ │ • Invalidate CloudFront  │      │
│ └──────────────────────────┘ └──────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VERIFY ROLLBACK                               │
├─────────────────────────────────────────────────────────────────┤
│ • Test API health endpoint                                      │
│ • Test Employee Register accessibility                          │
│ • Test Customer Kiosk accessibility                             │
│                                                                 │
│ Summary:                                                        │
│ • Environment rolled back to: $git_ref                          │
│ • Reason: $reason                                               │
│ • All services verified healthy ✓                               │
└─────────────────────────────────────────────────────────────────┘
```

## AWS Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS RESOURCES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐                                              │
│  │ GitHub Actions│                                              │
│  │   (OIDC)      │                                              │
│  └───────┬───────┘                                              │
│          │ assume role                                          │
│          ↓                                                      │
│  ┌───────────────┐                                              │
│  │   IAM Role    │                                              │
│  │ (apprunner-   │                                              │
│  │   access)     │                                              │
│  └───────┬───────┘                                              │
│          │                                                      │
│          ├─────────────────────┬────────────────────┐          │
│          ↓                     ↓                    ↓          │
│  ┌──────────────┐    ┌─────────────────┐   ┌────────────┐     │
│  │     ECR      │    │ Secrets Manager │   │    RDS     │     │
│  │  Repository  │    │                 │   │  Postgres  │     │
│  │              │    │ • DATABASE_URL  │   │            │     │
│  │ club-ops-api │    │ • KIOSK_TOKEN   │   │ club_ops   │     │
│  └──────┬───────┘    └─────────┬───────┘   └─────┬──────┘     │
│         │                      │                  │            │
│         │ pull image           │ read secrets     │ connect    │
│         ↓                      ↓                  ↓            │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              App Runner Service                      │      │
│  │                                                      │      │
│  │  ┌────────────────────────────────────────────┐     │      │
│  │  │  Container (Node.js)                       │     │      │
│  │  │                                            │     │      │
│  │  │  • Port 3000                               │     │      │
│  │  │  • Env vars: LOG_LEVEL, DEMO_MODE, etc.   │     │      │
│  │  │  • Secrets: DATABASE_URL, KIOSK_TOKEN     │     │      │
│  │  │  • Health: GET /health                     │     │      │
│  │  │  • Auto-scaling: 1-10 instances            │     │      │
│  │  └────────────────────────────────────────────┘     │      │
│  │                                                      │      │
│  └───────────────────────────┬──────────────────────────┘      │
│                              │                                 │
│                              ↓                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │         API Gateway HTTP API                         │      │
│  │                                                      │      │
│  │  • Route: ANY /{proxy+}                             │      │
│  │  • Integration: HTTP_PROXY to App Runner            │      │
│  │  • Stage: $default (auto-deploy)                    │      │
│  └──────────────────────────┬───────────────────────────┘      │
│                             │                                  │
│                             │ HTTPS                            │
│                             ↓                                  │
│                 https://api.execute-api.amazonaws.com          │
│                                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                S3 Buckets                            │      │
│  │                                                      │      │
│  │  ┌────────────────────┐  ┌────────────────────┐     │      │
│  │  │  employee-register │  │  customer-kiosk    │     │      │
│  │  │  (static files)    │  │  (static files)    │     │      │
│  │  └─────────┬──────────┘  └─────────┬──────────┘     │      │
│  │            │                       │                │      │
│  │            │ origin                │ origin         │      │
│  │            ↓                       ↓                │      │
│  │  ┌────────────────────┐  ┌────────────────────┐     │      │
│  │  │  CloudFront Dist.  │  │  CloudFront Dist.  │     │      │
│  │  │  (CDN + TLS)       │  │  (CDN + TLS)       │     │      │
│  │  └─────────┬──────────┘  └─────────┬──────────┘     │      │
│  └────────────┼─────────────────────────┼──────────────┘      │
│               │                         │                     │
│               │ HTTPS                   │ HTTPS               │
│               ↓                         ↓                     │
│  employee-demo.joshuakessell.com   customer-demo....com       │
│                                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │            AppSync Events (Realtime)                 │      │
│  │                                                      │      │
│  │  • HTTP Endpoint for publishing                     │      │
│  │  • Channel namespace: club-ops                      │      │
│  │  • WebSocket alternative                            │      │
│  │  • Used by: API (publish), Frontends (subscribe)   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Comparison

| Feature | Demo | Production |
|---------|------|------------|
| Trigger | Push to `main` | Git tag `v*` |
| Demo Mode | ✓ Enabled | ✗ Disabled |
| Data Seeding | ✓ Auto-reseed | ✗ None |
| DB Migrations | ✓ Before seed | ✓ Before deploy |
| Quality Gates | ✓ CI only | ✓ Pre-deploy |
| Smoke Tests | ✗ None | ✓ Post-deploy |
| Secrets Suffix | (none) | `_PROD` |
| SSL (DB) | ✓ Enabled | ✓ Enabled |

## Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/aws/deploy-api.sh` | Build + push Docker image, run migrations, update App Runner |
| `scripts/aws/deploy-employee-register.sh` | Build frontend, sync to S3, invalidate CloudFront |
| `scripts/aws/deploy-customer-kiosk.sh` | Build frontend, sync to S3, invalidate CloudFront |
| `scripts/aws/deploy-all.sh` | Orchestrates all deployment scripts |
| `scripts/aws/seed-demo-via-ssm.sh` | Seeds database via SSM tunnel to RDS |
| `services/api/scripts/migrate.ts` | Run database migrations |
| `services/api/src/db/seed-demo.ts` | Demo data seeding script |

## Quality Gates

```
┌──────────────────────────────────────────┐
│        BEFORE ANY DEPLOYMENT             │
├──────────────────────────────────────────┤
│ 1. pnpm lint         (ESLint)           │
│ 2. pnpm typecheck    (TypeScript)       │
│ 3. pnpm spec:check   (Business spec)    │
│ 4. pnpm build        (All packages)     │
└──────────────────────────────────────────┘
```

## Monitoring Points

```
┌────────────────────────────────────────────────────────┐
│                   HEALTH CHECKS                        │
├────────────────────────────────────────────────────────┤
│ • API: GET /health → 200 OK                           │
│ • Employee: GET / → 200 OK                            │
│ • Customer: GET / → 200 OK                            │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                CLOUDWATCH METRICS                      │
├────────────────────────────────────────────────────────┤
│ • App Runner: CPU, Memory, Request Count, Latency     │
│ • RDS: Connection Count, CPU, Storage                 │
│ • CloudFront: Request Count, Error Rate, Latency      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                   LOGS                                 │
├────────────────────────────────────────────────────────┤
│ • App Runner: /aws/apprunner/club-ops-*/service        │
│ • RDS: PostgreSQL logs (via CloudWatch)               │
└────────────────────────────────────────────────────────┘
```
