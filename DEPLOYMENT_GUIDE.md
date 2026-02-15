# Club Operations Deployment Pipeline

Complete deployment infrastructure for production environments.

## Architecture Overview

The pipeline supports two deployment targets:

- **Docker Compose** - Single-host production deployments
- **AWS App Runner** (CloudFormation) - Serverless managed deployments

## Quick Start

### 1. Pre-deployment Validation

```bash
./scripts/validate-deployment.sh production
```

This validates:
- Docker and docker-compose installation
- Required configuration files
- Docker image builds
- Environment variables
- System resources

### 2. Docker Compose Deployment

**Create environment file:**
```bash
cp .env.example .env.production
# Edit .env.production with your production secrets
```

**Deploy:**
```bash
docker-compose -f docker-compose.production.yml up -d
```

**Monitor:**
```bash
docker-compose logs -f api
```

**Access services:**
- API: http://localhost:3000
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090



### 3. AWS CloudFormation (Existing)

Uses existing `infra.yaml` CloudFormation template:

```bash
aws cloudformation deploy \
  --template-file infra.yaml \
  --stack-name club-ops-prod \
  --parameter-overrides \
    EnvName=production \
    KioskToken=<your-token> \
    DbPassword=<strong-password> \
  --capabilities CAPABILITY_NAMED_IAM
```

## CI/CD Workflows

### GitHub Actions Workflows

#### 1. `build.yml` - Build & Test
Triggers on:
- Push to main branch
- Pull requests to main branch

Jobs:
1. Unit tests, linting, type checking
2. Build Docker images for all services
3. Push to GHCR (GitHub Container Registry)
4. Security scan with Trivy

#### 2. `deploy-prod.yml` - Production Deployment
Triggers on:
- Tag push (v*.*.*) - automatic
- Manual workflow dispatch

Jobs:
1. Pull Docker images from registry
2. Pre-deployment validation
3. Deploy with docker-compose
4. Health checks
5. Smoke tests
6. Automatic rollback on failure

#### 3. `deploy.yml` - Dev/Staging Deployment
Existing workflow, triggers on main push.

## Monitoring & Observability

### Stack Components

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and management

### Accessing Monitoring

**Grafana:**
```bash
# Username: admin
# Password: (from GRAFANA_PASSWORD env var)
http://localhost:3001
```

**Prometheus:**
```bash
http://localhost:9090
```

### Alerts

Defined in `infra/prometheus-rules.yml`:

- API downtime (critical)
- High error rate > 5% (warning)
- High latency > 1s p95 (warning)
- Database downtime (critical)
- High database connections > 90 (warning)
- Container restarts (warning)

## Database Management

### Automatic Backups

Backup script: `scripts/db-backup.sh`

**Create backup:**
```bash
./scripts/db-backup.sh backup production
```

Backup location: `./db/backups/db_production_YYYYMMDD_HHMMSS.sql.gz`

**Automatic retention:** Last 7 backups kept

### Restore Database

```bash
./scripts/db-backup.sh restore production
```

Prompts for confirmation before overwriting.

## Scaling

### Docker Compose
Resource limits in `docker-compose.production.yml`:

- API: 512MB memory, 1 vCPU max
- Frontends: 256MB memory, 0.5 vCPU max
- Database: 512MB memory

Scale by increasing replicas or increasing individual limits.



## Security

### Image Security
- Non-root user execution
- Dropped Linux capabilities (ALL)
- Read-only root filesystem (where possible)
- Security scanning with Trivy



### Secrets Management

**Docker Compose:**
- Use `.env.production` file (gitignored)
- Secrets never committed to repository



**AWS:**
- Secrets Manager for sensitive data
- IAM roles for access control

## Rollback Procedures

### Docker Compose
```bash
# Revert to previous image tag
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```



### GitHub Actions
Automatic rollback on failed smoke tests in `deploy-prod.yml`.

## Performance Tuning

### Database
- Connection pool: `DB_POOL_MAX=20`
- Indexes optimized for queries
- Autovacuum enabled

### API
- Caching headers configured
- Gzip compression enabled
- Rate limiting enabled (100 req/s)

### Frontend
- Static asset caching
- CDN-ready (CloudFront, Cloudflare)
- Service Worker for offline support

## Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs api

# Check health
docker-compose ps

# Validate configuration
docker-compose config
```

### Database connection errors
```bash
# Verify database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Test connection
docker-compose exec api psql -h db -U clubops -d club_operations -c "SELECT 1;"
```

### High memory usage
```bash
# Check current usage
docker stats

# Increase limits in docker-compose.production.yml
# Redeploy
docker-compose up -d
```

### Deployment failures
```bash
# Check GitHub Actions logs for detailed error
# Review pre-deployment validation output
./scripts/validate-deployment.sh production

# Manually test image pull
docker pull ghcr.io/joshuakessell/club-operations-pos-api:latest
```

## Environment Variables

### API Configuration
```
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DB_HOST=db
DB_PORT=5432
DB_NAME=club_operations
DB_USER=clubops
DB_PASSWORD=<secret>
DB_POOL_MAX=20
KIOSK_TOKEN=<secret>
WEBAUTHN_RP_ID=example.com
SQUARE_ENVIRONMENT=production
SQUARE_ACCESS_TOKEN=<secret>
SQUARE_LOCATION_ID=<secret>
DEMO_MODE=false
SEED_ON_STARTUP=false
```

### Frontend Configuration
```
VITE_API_BASE_URL=https://api.example.com
VITE_KIOSK_TOKEN=<from KIOSK_TOKEN>
```

### Monitoring
```
GRAFANA_PASSWORD=<strong-password>
PROMETHEUS_RETENTION=15d
```

## Support & Debugging

For deployment issues, check:

1. **Pre-deployment validation:** `./scripts/validate-deployment.sh`
2. **Docker logs:** `docker-compose logs -f [service]`
3. **System resources:** `docker stats`
4. 
For persistent issues, collect:
- Docker version: `docker --version`
- docker-compose version: `docker-compose --version`
- Error logs (last 100 lines)
- System information: `uname -a`
- Environment details: `docker-compose config`
