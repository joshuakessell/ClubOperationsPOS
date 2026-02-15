# Deployment Operations Checklist

## Initial Setup (One-Time)

### AWS Infrastructure Setup

- [ ] Deploy CloudFormation stack (`infra.yaml`)
  ```bash
  aws cloudformation create-stack \
    --stack-name club-ops-demo \
    --template-body file://infra.yaml \
    --parameters \
      ParameterKey=KioskToken,ParameterValue="SECURE_TOKEN" \
      ParameterKey=DbPassword,ParameterValue="SECURE_PASSWORD" \
    --capabilities CAPABILITY_NAMED_IAM
  ```

- [ ] Create S3 buckets for frontends
  ```bash
  aws s3 mb s3://club-ops-employee-demo
  aws s3 mb s3://club-ops-customer-demo
  ```

- [ ] Create CloudFront distributions for frontends
  - Point origin to S3 buckets
  - Enable HTTPS (ACM certificate)
  - Set error page: 404 → /index.html (for SPA routing)

- [ ] Configure AppSync Events for realtime
  - Create channel namespace: `club-ops`
  - Get HTTP endpoint URL

- [ ] Create IAM OIDC provider for GitHub Actions
  ```bash
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
    --client-id-list sts.amazonaws.com
  ```

- [ ] Create IAM role for GitHub Actions
  - Trust policy: GitHub OIDC provider
  - Permissions: ECR, App Runner, S3, CloudFront, Secrets Manager, RDS

### GitHub Configuration

- [ ] Configure repository secrets (Demo):
  - `AWS_ROLE_ARN`
  - `AWS_REGION`
  - `APP_RUNNER_SERVICE_ARN`
  - `ECR_REPO_URI`
  - `DATABASE_URL_SECRET_ARN`
  - `KIOSK_TOKEN_SECRET_ARN`
  - `APPSYNC_EVENTS_HTTP_ENDPOINT`

- [ ] Configure repository variables (Demo):
  - `EMPLOYEE_BUCKET`
  - `EMPLOYEE_DISTRIBUTION_ID`
  - `CUSTOMER_BUCKET`
  - `CUSTOMER_DISTRIBUTION_ID`

- [ ] Configure production secrets (all with `_PROD` suffix):
  - `AWS_ROLE_ARN_PROD`
  - `APP_RUNNER_SERVICE_ARN_PROD`
  - `ECR_REPO_URI_PROD`
  - `DATABASE_URL_SECRET_ARN_PROD`
  - `KIOSK_TOKEN_SECRET_ARN_PROD`
  - `APPSYNC_EVENTS_HTTP_ENDPOINT_PROD`
  - `APPSYNC_EVENTS_CHANNEL_NAMESPACE_PROD`
  - `API_BASE_URL_PROD`
  - `EMPLOYEE_URL_PROD`
  - `CUSTOMER_URL_PROD`
  - `EMPLOYEE_BUCKET_PROD`
  - `EMPLOYEE_DISTRIBUTION_ID_PROD`
  - `CUSTOMER_BUCKET_PROD`
  - `CUSTOMER_DISTRIBUTION_ID_PROD`

- [ ] Enable GitHub Actions for repository

- [ ] Configure branch protection for `main`:
  - Require pull request reviews
  - Require status checks: `validate`, `docker-validate`, `security-scan`
  - Require branches to be up to date

### Local Development Setup

- [ ] Clone repository
  ```bash
  git clone https://github.com/your-org/ClubOperationsPOS.git
  cd ClubOperationsPOS
  ```

- [ ] Install dependencies
  ```bash
  pnpm install
  ```

- [ ] Copy environment template
  ```bash
  cp .env.example .env
  ```

- [ ] Edit `.env` with local values
  - Set `KIOSK_TOKEN`
  - Configure database credentials

- [ ] Start database
  ```bash
  pnpm db:start
  ```

- [ ] Run migrations
  ```bash
  pnpm db:migrate
  ```

- [ ] Seed database
  ```bash
  pnpm db:seed
  ```

- [ ] Verify setup
  ```bash
  pnpm lint
  pnpm typecheck
  pnpm spec:check
  pnpm build
  ```

## Regular Development Workflow

### Creating a Feature

- [ ] Create feature branch
  ```bash
  git checkout -b feature/my-feature
  ```

- [ ] Make changes and commit
  ```bash
  git add .
  git commit -m "feat: add new feature

  Assisted-By: cagent"
  ```

- [ ] Run quality gates locally
  ```bash
  pnpm lint
  pnpm typecheck
  pnpm spec:check
  ```

- [ ] Test Docker build locally (if touching Dockerfiles)
  ```bash
  docker build -f Dockerfile.api -t test-api .
  ```

- [ ] Push branch
  ```bash
  git push origin feature/my-feature
  ```

- [ ] Create Pull Request
  - CI pipeline runs automatically
  - Wait for all checks to pass
  - Request review

### Merging to Main (Demo Deployment)

- [ ] Ensure PR approved and checks passing

- [ ] Merge PR
  ```bash
  git checkout main
  git pull origin main
  ```

- [ ] Monitor deployment
  - GitHub Actions: Watch `Deploy (dev)` workflow
  - Wait for completion (~10-15 minutes)

- [ ] Verify deployment
  ```bash
  # API health
  curl https://api-demo.joshuakessell.com/health
  
  # Employee register
  curl -I https://employee-demo.joshuakessell.com
  
  # Customer kiosk
  curl -I https://customer-demo.joshuakessell.com
  ```

- [ ] Test critical user flows on demo environment
  - Staff login
  - Customer check-in
  - Room assignment
  - Checkout process

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing on `main`
- [ ] Demo environment stable and tested
- [ ] Database migrations reviewed and tested
- [ ] Breaking changes documented
- [ ] Rollback plan prepared
- [ ] Stakeholders notified of deployment window

### Create Release

- [ ] Decide on version number (semantic versioning)
  - MAJOR: Breaking changes
  - MINOR: New features (backward compatible)
  - PATCH: Bug fixes

- [ ] Create and push tag
  ```bash
  git checkout main
  git pull origin main
  git tag -a v1.2.3 -m "Release v1.2.3
  
  Features:
  - Feature A
  - Feature B
  
  Bug fixes:
  - Fix X
  - Fix Y"
  
  git push origin v1.2.3
  ```

- [ ] Monitor deployment
  - GitHub Actions: Watch `Deploy Production` workflow
  - Pre-deployment validation
  - API deployment
  - Frontend deployments
  - Smoke tests

### Post-Deployment Verification

- [ ] Check smoke tests passed

- [ ] Manual health checks
  ```bash
  curl $API_BASE_URL_PROD/health
  curl -I $EMPLOYEE_URL_PROD
  curl -I $CUSTOMER_URL_PROD
  ```

- [ ] Test critical paths
  - Staff authentication
  - Customer check-in flow
  - Payment processing
  - Real-time updates
  - Room management

- [ ] Monitor error rates
  ```bash
  # Check CloudWatch logs for errors
  aws logs tail /aws/apprunner/club-ops-prod-api/service \
    --follow \
    --filter-pattern "ERROR"
  ```

- [ ] Check database migrations applied
  ```bash
  # Connect to production database
  # Verify schema_migrations table
  SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;
  ```

- [ ] Monitor performance metrics
  - App Runner CPU/Memory
  - API response times
  - Database connection pool
  - CloudFront cache hit ratio

### Communication

- [ ] Update release notes in GitHub
- [ ] Notify team of successful deployment
- [ ] Update status page (if applicable)
- [ ] Document any manual steps taken

## Rollback Procedure

### When to Rollback

Immediate rollback if:
- Critical functionality broken
- Data corruption detected
- Security vulnerability introduced
- Unacceptable performance degradation
- Database migration failed

### Execute Rollback

- [ ] Identify last working version
  ```bash
  # List recent tags
  git tag -l "v*" | tail -5
  ```

- [ ] Trigger rollback workflow
  ```bash
  gh workflow run rollback.yml \
    -f environment=production \
    -f git_ref=v1.2.2 \
    -f reason="Critical bug in checkout flow causing payment failures"
  ```

- [ ] Monitor rollback progress
  - API rollback
  - Frontend rollbacks
  - Verification tests

- [ ] Verify rollback successful
  ```bash
  # Test affected functionality
  curl $API_BASE_URL_PROD/health
  # Test user flows
  ```

### Database Rollback (if needed)

⚠️ **DANGER**: Database rollbacks can cause data loss

- [ ] If migration needs reverting:
  ```bash
  # Connect via SSM tunnel
  scripts/aws/seed-demo-via-ssm.sh
  
  # In another terminal
  psql $DATABASE_URL
  
  # Manually revert migration
  # (Write reverse SQL based on migration file)
  ```

- [ ] Verify data integrity after rollback

### Post-Rollback

- [ ] Notify team of rollback
- [ ] Update incident report
- [ ] Create hotfix branch to fix issue
- [ ] Test hotfix thoroughly before redeployment

## Hotfix Deployment

### For Critical Production Issues

- [ ] Create hotfix branch from production tag
  ```bash
  git checkout -b hotfix/critical-bug v1.2.3
  ```

- [ ] Make minimal fix
  ```bash
  # Make changes
  git add .
  git commit -m "hotfix: fix critical bug
  
  Assisted-By: cagent"
  ```

- [ ] Run quality gates
  ```bash
  pnpm lint
  pnpm typecheck
  pnpm spec:check
  pnpm build
  ```

- [ ] Create PR and get emergency review
  - Fast-track approval process
  - Ensure tests pass

- [ ] Merge to main
  ```bash
  git checkout main
  git merge hotfix/critical-bug
  git push origin main
  ```

- [ ] Create hotfix tag
  ```bash
  git tag v1.2.4
  git push origin v1.2.4
  ```

- [ ] Monitor deployment to production

- [ ] Verify fix in production

## Database Maintenance

### Creating Migrations

- [ ] Create migration file
  ```bash
  # Naming: YYYYMMDDHHMMSS_description.sql
  touch services/api/migrations/20260210120000_add_new_column.sql
  ```

- [ ] Write SQL with safety checks
  ```sql
  -- Add column if not exists
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'new_column'
    ) THEN
      ALTER TABLE users ADD COLUMN new_column VARCHAR(255);
    END IF;
  END $$;
  ```

- [ ] Test migration locally
  ```bash
  pnpm db:migrate
  ```

- [ ] Verify no data loss
  ```bash
  # Check row counts
  psql -c "SELECT COUNT(*) FROM users"
  ```

- [ ] Document migration in PR description

### Backup Before Risky Operations

- [ ] Create manual backup
  ```bash
  # For demo environment
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
  
  # For production (via AWS)
  aws rds create-db-snapshot \
    --db-instance-identifier club-ops-prod-db \
    --db-snapshot-identifier manual-backup-$(date +%Y%m%d-%H%M%S)
  ```

## Monitoring and Alerts

### Daily Checks

- [ ] Review CloudWatch dashboard
  - API error rates
  - Database connection pool usage
  - Response time percentiles (p50, p95, p99)

- [ ] Check App Runner health
  ```bash
  aws apprunner describe-service \
    --service-arn $APP_RUNNER_SERVICE_ARN_PROD \
    --query 'Service.Status'
  ```

- [ ] Review recent errors
  ```bash
  aws logs filter-log-events \
    --log-group-name /aws/apprunner/club-ops-prod-api/service \
    --filter-pattern "ERROR" \
    --start-time $(date -d '24 hours ago' +%s)000
  ```

### Weekly Checks

- [ ] Review database performance
  - Slow query log
  - Index usage
  - Table sizes

- [ ] Check disk usage
  - RDS storage
  - ECR image sizes

- [ ] Review security scan results
  - Dependency updates needed

- [ ] Update dependencies (if needed)
  ```bash
  pnpm update --latest --interactive
  ```

## Troubleshooting Common Issues

### Build Failures

- [ ] Check pnpm-lock.yaml in sync
  ```bash
  rm -rf node_modules pnpm-lock.yaml
  pnpm install
  ```

- [ ] Clear Turbo cache
  ```bash
  rm -rf node_modules/.cache
  pnpm turbo run build --force
  ```

### Docker Build Failures

- [ ] Check Docker logs
  ```bash
  docker logs <container_id>
  ```

- [ ] Verify Dockerfile context
  ```bash
  # Ensure build artifacts exist
  ls -la services/api/dist/
  ```

- [ ] Clear Docker cache
  ```bash
  docker builder prune
  ```

### Deployment Stuck

- [ ] Check App Runner status
  ```bash
  aws apprunner describe-service \
    --service-arn $APP_RUNNER_SERVICE_ARN
  ```

- [ ] Check recent operations
  ```bash
  aws apprunner list-operations \
    --service-arn $APP_RUNNER_SERVICE_ARN
  ```

- [ ] Force new deployment
  ```bash
  aws apprunner start-deployment \
    --service-arn $APP_RUNNER_SERVICE_ARN
  ```

### Database Connection Issues

- [ ] Verify security group rules
  ```bash
  aws ec2 describe-security-groups \
    --group-ids <sg-id>
  ```

- [ ] Test connection from App Runner
  ```bash
  # Check App Runner logs for connection errors
  aws logs tail /aws/apprunner/club-ops-*/service --follow
  ```

- [ ] Verify DATABASE_URL secret
  ```bash
  aws secretsmanager get-secret-value \
    --secret-id $DATABASE_URL_SECRET_ARN
  ```

## Security Operations

### Rotate Secrets

- [ ] Rotate KIOSK_TOKEN
  ```bash
  # Generate new token
  new_token=$(openssl rand -hex 32)
  
  # Update Secrets Manager
  aws secretsmanager update-secret \
    --secret-id $KIOSK_TOKEN_SECRET_ARN \
    --secret-string "{\"KIOSK_TOKEN\":\"$new_token\"}"
  
  # Update .env.example (placeholder only)
  # Redeploy API and frontends
  ```

- [ ] Rotate database password
  ```bash
  # Update RDS master password
  aws rds modify-db-instance \
    --db-instance-identifier club-ops-prod-db \
    --master-user-password "NEW_SECURE_PASSWORD" \
    --apply-immediately
  
  # Update DATABASE_URL in Secrets Manager
  # Redeploy API
  ```

### Review Access

- [ ] Audit IAM role permissions
- [ ] Review GitHub Actions logs
- [ ] Check RDS access logs
- [ ] Review CloudFront access logs

## Cost Optimization

### Monthly Review

- [ ] Check AWS Cost Explorer
  - App Runner costs
  - RDS costs
  - Data transfer costs
  - ECR storage costs

- [ ] Review RDS instance size
  - Consider downsizing if underutilized
  - Demo: db.t4g.micro sufficient
  - Prod: Scale based on load

- [ ] Clean up old ECR images
  ```bash
  # List images
  aws ecr list-images \
    --repository-name club-ops-api
  
  # Delete old images (keep last 10)
  # Manual cleanup or lifecycle policy
  ```

- [ ] Review CloudFront cache settings
  - Optimize TTL for static assets
  - Reduce origin requests

## Documentation Updates

### When to Update Docs

- [ ] After infrastructure changes → `docs/DEPLOYMENT.md`
- [ ] After workflow changes → `docs/deployment-pipeline-diagram.md`
- [ ] After adding secrets → `docs/DEPLOYMENT_QUICKREF.md`
- [ ] After file structure changes → `docs/FILE_STRUCTURE.md`
- [ ] After business rule changes → `SPEC.md` + `docs/specs/*.md`
- [ ] After deployment rules changes → `agents.md`

## Emergency Contacts

(Configure based on your team)

- [ ] On-call engineer: _____________
- [ ] Database admin: _____________
- [ ] AWS account owner: _____________
- [ ] Product owner: _____________
