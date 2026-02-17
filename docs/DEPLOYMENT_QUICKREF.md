# Deployment Quick Reference

Quick commands for common deployment tasks.

## Local Development

```bash
# Start all services with Docker Compose
docker compose up -d

# Development mode with hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Start without Docker (requires local Postgres)
pnpm dev

# Build all packages
pnpm build

# Run quality gates
pnpm lint && pnpm typecheck && pnpm spec:check
```

## Deployment

### Development (Demo)
**Automatic:** Every push to `main` triggers deployment to demo environment.

**Manual:**
```bash
# Trigger deploy workflow
gh workflow run deploy.yml
```

### Production
**Git Tag Deployment:**
```bash
# Create and push tag
git tag v1.0.0
git push origin v1.0.0
```

**Manual Deployment:**
```bash
# Trigger production deploy workflow
gh workflow run deploy-production.yml -f environment=production
```

### Rollback
```bash
# Rollback to specific tag/commit
gh workflow run rollback.yml \
  -f environment=production \
  -f git_ref=v1.0.0 \
  -f reason="Bug in latest release"
```

## Database Operations

### Local
```bash
# Start database
pnpm db:start

# Run migrations
pnpm db:migrate

# Seed data
pnpm db:seed

# Reset database
pnpm db:reset

# Stop database
pnpm db:stop
```

### Remote (AWS)
```bash
# Migrations run automatically during deployment
# Or manually via SSM tunnel:
scripts/aws/seed-demo-via-ssm.sh
```

## Docker Commands

### Build Individual Images
```bash
# API
docker build -f Dockerfile.api -t club-ops-api .

# Frontends
docker build -f Dockerfile.customer-kiosk -t club-ops-customer-kiosk .
docker build -f Dockerfile.employee-kiosk -t club-ops-employee-kiosk .
docker build -f Dockerfile.office-dashboard -t club-ops-office-dashboard .
```

### Docker Compose Operations
```bash
# View logs
docker compose logs -f api

# Restart specific service
docker compose restart api

# Rebuild and restart
docker compose up -d --build api

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## AWS Operations

### Deploy API Only
```bash
export APP_RUNNER_SERVICE_ARN="..."
export ECR_REPO_URI="..."
export DATABASE_URL_SECRET_ARN="..."
export KIOSK_TOKEN_SECRET_ARN="..."
export AWS_REGION="us-east-1"
export APPSYNC_EVENTS_HTTP_ENDPOINT="..."
export APPSYNC_EVENTS_CHANNEL_NAMESPACE="club-ops"
export DB_SSL="true"
export DB_SSL_CA_PATH=""
export LOG_LEVEL="info"
export DEMO_MODE="false"
export SKIP_DB_MIGRATIONS="false"
export SKIP_DEMO_SEED="true"
export SKIP_DB_VERIFY="false"
export SEED_ON_STARTUP="false"
export DEMO_INCREMENTAL="false"
export DEMO_RESET_ON_STARTUP="false"
export DEMO_SHIFT_REGENERATE_PDFS="false"
export DEMO_FORCE_RESEED="false"
export DB_LOG_QUERIES="false"
export SKIP_PNPM_INSTALL="false"

scripts/aws/deploy-api.sh
```

### Deploy Frontend Only
```bash
export VITE_API_BASE_URL="https://api.example.com"
export VITE_REALTIME_PROVIDER="appsync-events"
export VITE_REALTIME_CHANNEL_NAMESPACE="club-ops"
export VITE_DISABLE_WS="false"
export KIOSK_TOKEN_SECRET_ARN="..."
export EMPLOYEE_BUCKET="..."
export EMPLOYEE_DISTRIBUTION_ID="..."
export SKIP_PNPM_INSTALL="false"

scripts/aws/deploy-employee-kiosk.sh
```

### CloudFormation Stack
```bash
# Create infrastructure stack
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

# Delete stack (DANGER)
aws cloudformation delete-stack --stack-name club-ops-demo
```

### View Logs
```bash
# App Runner logs
aws logs tail /aws/apprunner/club-ops-demo-api/service --follow

# Query for errors
aws logs filter-log-events \
  --log-group-name /aws/apprunner/club-ops-demo-api/service \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

## Monitoring

### Health Checks
```bash
# API health
curl https://api-demo.joshuakessell.com/health

# Frontend accessibility
curl -I https://employee-demo.joshuakessell.com
curl -I https://customer-demo.joshuakessell.com
```

### Service Status
```bash
# App Runner service status
aws apprunner describe-service \
  --service-arn "$APP_RUNNER_SERVICE_ARN" \
  --query 'Service.Status' \
  --output text

# CloudFront distribution status
aws cloudfront get-distribution \
  --id "$DISTRIBUTION_ID" \
  --query 'Distribution.Status' \
  --output text
```

## GitHub Actions

### View Workflow Status
```bash
# List recent runs
gh run list --workflow=deploy.yml

# View specific run
gh run view 12345678

# Watch run in progress
gh run watch
```

### Secrets Management
```bash
# Set GitHub secret
gh secret set AWS_ROLE_ARN --body "arn:aws:iam::..."

# List secrets
gh secret list

# Delete secret
gh secret delete OLD_SECRET
```

## Troubleshooting

### Build Failures
```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Clear Turbo cache
rm -rf node_modules/.cache

# Rebuild all packages
pnpm turbo run build --force
```

### Docker Issues
```bash
# Prune everything
docker system prune -a

# Check Docker disk usage
docker system df

# View build cache
docker buildx du

# Clear build cache
docker buildx prune
```

### Database Connection
```bash
# Test connection locally
psql postgresql://clubops:club-ops-dev@localhost:5433/club_operations

# Test connection via Docker
docker compose exec db psql -U clubops -d club_operations

# Check database logs
docker compose logs db
```

### App Runner Deployment Issues
```bash
# View latest deployment events
aws apprunner list-operations \
  --service-arn "$APP_RUNNER_SERVICE_ARN" \
  --max-results 10

# Describe service
aws apprunner describe-service \
  --service-arn "$APP_RUNNER_SERVICE_ARN"

# Force new deployment
aws apprunner start-deployment \
  --service-arn "$APP_RUNNER_SERVICE_ARN"
```

## Environment URLs

### Development (Demo)
- API: https://api-demo.joshuakessell.com
- Employee Register: https://employee-demo.joshuakessell.com
- Customer Kiosk: https://customer-demo.joshuakessell.com

### Production
(Configure in GitHub secrets: `API_BASE_URL_PROD`, `EMPLOYEE_URL_PROD`, `CUSTOMER_URL_PROD`)

## Required GitHub Secrets

### Demo Environment
- `AWS_ROLE_ARN`
- `APP_RUNNER_SERVICE_ARN`
- `ECR_REPO_URI`
- `DATABASE_URL_SECRET_ARN`
- `KIOSK_TOKEN_SECRET_ARN`
- `APPSYNC_EVENTS_HTTP_ENDPOINT`
- `EMPLOYEE_BUCKET` (variable)
- `EMPLOYEE_DISTRIBUTION_ID` (variable)
- `CUSTOMER_BUCKET` (variable)
- `CUSTOMER_DISTRIBUTION_ID` (variable)

### Production Environment
All demo secrets plus `_PROD` suffix:
- `AWS_ROLE_ARN_PROD`
- `APP_RUNNER_SERVICE_ARN_PROD`
- etc.

## Quick Links

- [Full Deployment Guide](./DEPLOYMENT.md)
- [Docker Setup](../DOCKER.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Infrastructure Template](../infra.yaml)
