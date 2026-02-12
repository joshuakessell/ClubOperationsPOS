# Deployment Pipeline Documentation

This document describes the deployment architecture and CI/CD pipelines for the Club Operations POS system.

## Architecture Overview

The system consists of:

- **API Service** (Node.js/Fastify) - Backend API deployed to AWS App Runner
- **Customer Kiosk** (React/Vite) - Customer-facing UI deployed to S3 + CloudFront
- **Employee Register** (React/Vite) - Staff UI deployed to S3 + CloudFront
- **Office Dashboard** (React/Vite) - Admin UI deployed to S3 + CloudFront
- **PostgreSQL Database** - AWS RDS Postgres
- **Realtime Events** - AWS AppSync Events (WebSocket alternative)

## Environments

### Development (Demo)
- **Purpose**: Continuous integration testing and demo environment
- **Trigger**: Every push to `main` branch
- **API**: https://api-demo.joshuakessell.com
- **Employee**: https://employee-demo.joshuakessell.com
- **Customer**: https://customer-demo.joshuakessell.com
- **Demo Mode**: Enabled with automatic data reseeding

### Production
- **Purpose**: Live production environment
- **Trigger**: Git tags matching `v*` pattern
- **Demo Mode**: Disabled
- **Database Migrations**: Run automatically before deployment

## CI/CD Pipelines

### Development Deployment (`.github/workflows/deploy.yml`)

Deploys to demo environment on every `main` push.

**Steps:**
1. Run quality gates
2. Seed demo database via SSM tunnel
3. Deploy API to App Runner (ECR → App Runner)
4. Deploy employee-register to S3/CloudFront
5. Deploy customer-kiosk to S3/CloudFront

**Environment Variables (Demo):**
- `DEMO_MODE=true`
- `DEMO_RESET_ON_STARTUP=true`
- `DEMO_INCREMENTAL=true`
- `SEED_ON_STARTUP=false`

## Deployment Scripts

All deployment scripts are located in `scripts/aws/`:

### `deploy-api.sh`
Deploys the API service:
1. Builds `@club-ops/shared` and `@club-ops/api` packages
2. Builds Docker image with prebuilt artifacts
3. Pushes to ECR with SHA and `dev-latest` tags
4. Runs database migrations (unless `SKIP_DB_MIGRATIONS=true`)
5. Seeds demo data if `DEMO_MODE=true` and `SKIP_DEMO_SEED!=true`
6. Updates App Runner service with new image and environment

### `deploy-employee-register.sh` / `deploy-customer-kiosk.sh`
Deploys frontend apps:
1. Builds the app with Vite
2. Syncs `dist/` to S3 bucket
3. Invalidates CloudFront distribution cache

### `deploy-all.sh`
Convenience script that runs all deployment scripts in sequence.

## Infrastructure

### AWS Resources (CloudFormation: `infra.yaml`)

**Core Services:**
- **ECR Repository**: Docker image registry for API
- **RDS Postgres**: Database instance (publicly accessible for SSM tunnel)
- **App Runner**: Serverless container service for API
- **API Gateway HTTP API**: Public-facing HTTP endpoint for App Runner
- **Secrets Manager**: Stores `KIOSK_TOKEN` and `DATABASE_URL`

**Network:**
- VPC with 2 subnets across availability zones
- Internet Gateway for public access
- Security groups for database access

**Parameters:**
- `ProjectName` (default: club-ops)
- `EnvName` (default: demo)
- `ImageTag` (default: latest)
- `KioskToken` (secret)
- `DbPassword` (secret)
- `DbInstanceClass` (default: db.t4g.micro)

### CloudFormation Deployment

```bash
# Create stack
aws cloudformation create-stack \
  --stack-name club-ops-demo \
  --template-body file://infra.yaml \
  --parameters \
    ParameterKey=KioskToken,ParameterValue="your-token" \
    ParameterKey=DbPassword,ParameterValue="your-password" \
  --capabilities CAPABILITY_NAMED_IAM

# Update stack
aws cloudformation update-stack \
  --stack-name club-ops-demo \
  --template-body file://infra.yaml \
  --parameters \
    ParameterKey=KioskToken,UsePreviousValue=true \
    ParameterKey=DbPassword,UsePreviousValue=true \
  --capabilities CAPABILITY_NAMED_IAM
```

## Docker Configuration

### Multi-Stage Builds
All services use optimized multi-stage Dockerfiles:

1. **deps**: Install dependencies with pnpm cache mounts
2. **builder**: Build TypeScript/Vite apps with Turborepo
3. **runner**: Minimal runtime image (nginx for frontends, node:22-alpine for API)

### Docker Compose
- **Production**: `docker-compose.yml`
- **Development**: `docker-compose.yml` + `docker-compose.dev.yml` (volume mounts for hot reload)

See `DOCKER.md` for detailed Docker usage.

## Database Migrations

### Automatic Migrations
Migrations run automatically during API deployment via `scripts/migrate.ts`:

```bash
DATABASE_URL="..." pnpm exec tsx scripts/migrate.ts
```

### Manual Migrations
```bash
# Local
pnpm db:migrate

# Via SSM tunnel (AWS)
scripts/aws/seed-demo-via-ssm.sh
```

### Migration Files
Location: `services/api/migrations/*.sql`

Naming: `YYYYMMDDHHMMSS_description.sql`

## Environment Variables

### Required for Deployment

**API Service:**
- `APP_RUNNER_SERVICE_ARN` - AWS App Runner service ARN
- `ECR_REPO_URI` - ECR repository URI
- `DATABASE_URL_SECRET_ARN` - Secrets Manager ARN for DATABASE_URL
- `KIOSK_TOKEN_SECRET_ARN` - Secrets Manager ARN for KIOSK_TOKEN
- `APPSYNC_EVENTS_HTTP_ENDPOINT` - AppSync Events HTTP endpoint
- `APPSYNC_EVENTS_CHANNEL_NAMESPACE` - Channel namespace for realtime
- `AWS_REGION` - AWS region
- `DB_SSL` - Enable SSL for database (true/false)

**Frontend Apps:**
- `VITE_API_BASE_URL` - API base URL
- `VITE_REALTIME_PROVIDER` - Realtime provider (appsync-events)
- `VITE_REALTIME_CHANNEL_NAMESPACE` - Channel namespace
- `EMPLOYEE_BUCKET` / `CUSTOMER_BUCKET` - S3 bucket names
- `EMPLOYEE_DISTRIBUTION_ID` / `CUSTOMER_DISTRIBUTION_ID` - CloudFront distribution IDs

`VITE_KIOSK_TOKEN` is injected during build by resolving `KIOSK_TOKEN_SECRET_ARN` in the deploy scripts; keep only the secret ARN in GitHub secrets.

### GitHub Secrets Configuration

**Development (Demo):**
- `AWS_ROLE_ARN` - OIDC role for GitHub Actions
- `APP_RUNNER_SERVICE_ARN`
- `ECR_REPO_URI`
- `DATABASE_URL_SECRET_ARN`
- `KIOSK_TOKEN_SECRET_ARN`
- `APPSYNC_EVENTS_HTTP_ENDPOINT`

**Production:**
- All demo secrets with `_PROD` suffix
- `API_BASE_URL_PROD`
- `EMPLOYEE_URL_PROD`
- `CUSTOMER_URL_PROD`

## Local Development

### Using Docker Compose
```bash
# Production mode
docker compose up -d

# Development mode (hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# View logs
docker compose logs -f api

# Stop all services
docker compose down
```

### Using pnpm scripts
```bash
# Start all services (requires local Postgres)
pnpm dev

# Build all packages
pnpm build

# Run quality gates
pnpm lint
pnpm typecheck
pnpm spec:check
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Spec compliance passes (`pnpm spec:check`)
- [ ] Database migrations reviewed
- [ ] Environment variables configured

### Production Deployment
- [ ] Create git tag: `git tag v1.0.0 && git push origin v1.0.0`
- [ ] Monitor GitHub Actions workflow
- [ ] Verify smoke tests pass
- [ ] Check service health endpoints
- [ ] Verify database migrations applied
- [ ] Test critical user flows

### Rollback Procedure
1. Identify previous working tag/commit
2. Create new tag pointing to that commit
3. Push tag to trigger deployment
4. If database migration issue, manually revert via SQL

#### Lock-Step v2 Rollback Playbook

If Lock-Step v2 (flow commands / dual transport / LAN fallback) causes issues in **demo** or **production**, prefer
feature-flag rollback before code rollback.

**Immediate actions (API)**
- Disable global flags in the App Runner service env (or via your deployment config):
  - `LOCKSTEP_V2=false`
  - `FLOW_COMMANDS=false`
  - `LAN_FALLBACK=false`

**Immediate actions (Frontends)**
- Disable v2 flags in the Vite build env for the affected app(s) and redeploy:
  - `VITE_LOCKSTEP_V2=0`
  - `VITE_FLOW_COMMANDS=0`
  - `VITE_LAN_FALLBACK=0`
  - `VITE_REALTIME_TRANSPORTS=0` (forces legacy AppSync websocket path)
  - Unset `VITE_LAN_REALTIME_WS_URL` (if set)

**Targeted rollback (per-lane overrides)**
- If only some lanes are impacted, use `lane_feature_flags` overrides to disable features per lane while keeping the
  global rollout enabled.

**Code rollback (last resort)**
- Re-tag the last known-good commit and deploy it (standard rollback procedure above).
- If the rollback crosses DB migrations, validate that migrations are compatible. Avoid down-migrations in production
  unless you have confirmed they are safe for the current data.

## Monitoring and Logs

### App Runner Logs
```bash
# Stream logs
aws logs tail /aws/apprunner/club-ops-demo-api/service --follow

# Query logs
aws logs filter-log-events \
  --log-group-name /aws/apprunner/club-ops-demo-api/service \
  --filter-pattern "ERROR"
```

### CloudWatch Metrics
- App Runner service metrics (CPU, memory, requests)
- RDS database metrics (connections, CPU, storage)
- CloudFront distribution metrics (requests, errors)

## Security Considerations

- **Secrets Management**: All secrets stored in AWS Secrets Manager
- **Database Access**: RDS publicly accessible but secured by security groups
- **HTTPS**: All traffic encrypted with TLS via CloudFront/App Runner
- **OIDC Authentication**: GitHub Actions uses OIDC for AWS credentials (no long-lived keys)
- **Image Scanning**: Trivy scans for vulnerabilities in CI
- **Kiosk Token**: Shared secret for kiosk authentication (rotate periodically)

## Troubleshooting

### Build Failures
1. Check GitHub Actions logs
2. Run `pnpm build` locally
3. Verify all dependencies installed
4. Check Dockerfile syntax

### Deployment Failures
1. Check App Runner service logs
2. Verify environment variables set correctly
3. Check database connectivity
4. Verify ECR image pushed successfully

### Database Connection Issues
1. Verify security group rules
2. Check DATABASE_URL format
3. Verify SSL settings match
4. Test connection via SSM tunnel

### Frontend Issues
1. Check CloudFront distribution status
2. Verify S3 bucket permissions
3. Clear CloudFront cache
4. Check browser console for errors

## Cost Optimization

- **App Runner**: Auto-scales to zero when idle
- **RDS**: Use t4g.micro for demo environment
- **CloudFront**: No minimum charge, pay per request
- **S3**: Lifecycle policies for old deployments

## Future Enhancements

- [ ] Blue-green deployments for zero downtime
- [ ] Automated rollback on failed smoke tests
- [ ] Database backup automation
- [ ] Performance monitoring and alerting
- [ ] Multi-region deployment
- [ ] Preview environments for PRs
- [ ] Load testing in staging
