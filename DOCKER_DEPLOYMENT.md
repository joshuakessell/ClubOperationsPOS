# Docker Deployment Guide

## Quick Start

### Development
```bash
# Copy environment variables
cp .env.example .env

# Start all services
make dev

# View logs
make dev-logs
```

**Access Points:**
- API: http://localhost:3000
- Customer Kiosk: http://localhost:5173
- Employee Register: http://localhost:5175
- Office Dashboard: http://localhost:5176
- PostgreSQL: localhost:5433

### Production
```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with production values

# Start services
make prod

# View logs
make prod-logs
```

---

## Environment Setup

### 1. Create `.env` file
```bash
cp .env.example .env
```

### 2. Required Variables (set these)
```env
# Secrets - MUST BE SET
KIOSK_TOKEN=your-secure-token
DB_PASSWORD=your-secure-db-password
SQUARE_ACCESS_TOKEN=your-square-token

# Optional - use defaults if not specified
DB_PORT=5433
DB_NAME=club_operations
DB_USER=clubops
DEMO_MODE=false
SEED_ON_STARTUP=false
WEBAUTHN_RP_ID=yourdomain.com
```

---

## Building Images

### Option 1: Docker Compose (Recommended)
```bash
# Build all images
docker compose build

# Build specific image
docker compose build api

# Build with fresh cache
make rebuild
```

### Option 2: Individual Builds
```bash
# API
docker build --pull -f Dockerfile.api -t club-ops-api:v1.0.0 .

# Customer Kiosk
docker build --pull -f Dockerfile.customer-kiosk -t club-ops-customer-kiosk:v1.0.0 .

# All frontends
make build-frontends
```

### Option 3: Docker Buildx (Cross-Platform)
```bash
# Create buildx builder
docker buildx create --name multiplatform --driver docker-container

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.api \
  -t yourregistry/club-ops-api:latest \
  --push .
```

---

## Running Services

### Development with Hot Reload
```bash
# Start all services
make dev

# Start specific service
docker compose up api customer-kiosk

# Watch logs
make dev-logs

# Stop services
make down
```

### Production Deployment
```bash
# Using production compose file
make prod

# Or manually
docker compose -f docker-compose.prod.yml up -d --pull always

# Monitor
docker compose ps
docker compose logs -f api
```

### Manual Container Run (for testing)
```bash
# Run API only
docker run -d \
  --name club-ops-api \
  -p 3000:3000 \
  -e DB_HOST=db \
  -e DB_PASSWORD=secret \
  -e KIOSK_TOKEN=token \
  -e NODE_ENV=production \
  club-ops-api:latest

# Run frontend
docker run -d \
  --name club-ops-kiosk \
  -p 5173:80 \
  club-ops-customer-kiosk:latest
```

---

## Database Management

### Initialize Database
```bash
# Create schema (runs migrations)
make db-migrate

# Seed demo data
make db-seed

# Reset database completely
make db-reset
```

### Access PostgreSQL
```bash
# Via docker exec
docker compose exec db psql -U clubops -d club_operations

# Via psql client (if installed locally)
psql -h localhost -p 5433 -U clubops -d club_operations
```

### Backup & Restore
```bash
# Backup
docker compose exec db pg_dump -U clubops club_operations > backup.sql

# Restore
docker compose exec -T db psql -U clubops club_operations < backup.sql
```

---

## Monitoring & Health Checks

### View Service Status
```bash
# Quick status
make ps

# Health check details
make health

# Detailed inspection
docker inspect club-ops-api | jq '.State.Health'
```

### View Logs
```bash
# All services
make logs

# Specific service
docker compose logs -f api
docker compose logs -f customer-kiosk

# Last N lines
docker compose logs --tail=100 api

# With timestamps
docker compose logs -f --timestamps api
```

### Monitor Resource Usage
```bash
# Real-time stats
docker stats --no-stream

# Per-container memory/CPU
docker compose stats
```

---

## Security Scanning

### Docker Scout (Vulnerability Scanning)
```bash
# Install Docker Scout
docker scout version

# Scan images
make scan

# Manual scan with recommendations
docker scout recommendations club-ops-api:latest

# Generate SBOM (Software Bill of Materials)
docker scout sbom club-ops-api:latest
```

### Check Image Contents
```bash
# View all layers
docker history club-ops-api:latest

# Inspect file sizes
docker inspect club-ops-api:latest | jq '.Size'

# Find bloat
docker run --rm -it alpine/flake8 club-ops-api:latest
```

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose logs api

# Verify health
docker inspect club-ops-api | jq '.State.Health'

# Restart service
docker compose restart api
```

### Database Connection Issues
```bash
# Check database is running
docker compose ps db

# Test connection
docker compose exec -T api node -e "const pg = require('pg'); const client = new pg.Client({host:'db', user:'clubops', database:'club_operations', password:process.env.DB_PASSWORD}); client.connect((e) => console.log(e ? 'Failed' : 'OK'));"

# View DB logs
docker compose logs db
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Change port in .env
PORT=3001

# Restart
docker compose down && docker compose up -d
```

### Memory Issues
```bash
# Check usage
docker stats

# Set memory limits in docker-compose.yml
api:
  deploy:
    resources:
      limits:
        memory: 512M
```

### Image Build Fails
```bash
# Pull latest base images
docker pull node:22-alpine
docker pull nginx:1.27-alpine

# Rebuild without cache
make rebuild

# Check BuildKit version
docker buildx version
```

---

## Optimization Tips

### 1. Reduce Image Size
```bash
# Alpine-based images are already small
# For Node: node:22-alpine (~180MB) vs node:22 (~900MB)
# For nginx: nginx:1.27-alpine (~40MB) vs nginx:1.27 (~190MB)

# Scan size breakdown
docker history club-ops-api:latest --human
```

### 2. Faster Builds
```bash
# Use BuildKit
DOCKER_BUILDKIT=1 docker build -f Dockerfile.api .

# Build with inline cache
docker build \
  --build-arg=BUILDKIT_INLINE_CACHE=1 \
  -f Dockerfile.api .

# In CI/CD: cache from registry
docker build \
  --cache-from=registry.example.com/club-ops-api:latest \
  -f Dockerfile.api .
```

### 3. Reduce Build Time
```bash
# Install dependencies separately (cached layer)
# ✓ Good: COPY package*.json / RUN npm install / COPY . .
# ✗ Bad: COPY . . / RUN npm install

# Use .dockerignore to exclude files
# ✓ Includes: .git/, node_modules/, coverage/, *.log

# Parallel builds in CI/CD
docker build -f Dockerfile.api -t club-ops-api &
docker build -f Dockerfile.customer-kiosk -t club-ops-customer-kiosk &
wait
```

### 4. Multi-Stage Builds
```bash
# Already implemented in your Dockerfiles
# Example: Build in `builder` stage, copy artifacts to `runner` stage

# Target specific stage for debugging
docker build --target=builder -f Dockerfile.api .
```

---

## Production Checklist

- [ ] Copy `.env.example` to `.env` and set all required variables
- [ ] Change default passwords (DB_PASSWORD, SQUARE tokens)
- [ ] Set `NODE_ENV=production`
- [ ] Set `DEMO_MODE=false`
- [ ] Set `SEED_ON_STARTUP=false`
- [ ] Configure `WEBAUTHN_RP_ID` to your domain
- [ ] Configure `KIOSK_TOKEN` with secure value
- [ ] Run `docker scout cves` on all images
- [ ] Test backup & restore procedures
- [ ] Set up monitoring/logging aggregation
- [ ] Configure resource limits (memory, CPU)
- [ ] Use `restart: unless-stopped` policy (already configured)
- [ ] Use health checks (already configured)
- [ ] Set up log rotation for Docker daemon
- [ ] Use secrets management (Docker Secrets for Swarm, or environment variables for Compose)
- [ ] Test failover procedures

---

## Advanced Topics

### Docker Swarm Deployment
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml club-ops

# Scale services
docker service scale club-ops_api=3

# Use Docker Secrets
echo "secure-token" | docker secret create kiosk-token -

# Reference in compose
services:
  api:
    secrets:
      - kiosk-token
    environment:
      KIOSK_TOKEN_FILE: /run/secrets/kiosk-token
```

### Kubernetes Deployment
```bash
# Example: deploy API service to Kubernetes
kubectl create deployment club-ops-api --image=club-ops-api:latest
kubectl expose deployment club-ops-api --port=3000 --target-port=3000

# For production: use kustomize or Helm
# See KUBERNETES.md for complete setup
```

### Private Registry
```bash
# Push to private registry
docker tag club-ops-api:latest registry.example.com/club-ops-api:v1.0.0
docker push registry.example.com/club-ops-api:v1.0.0

# Pull in docker-compose.yml
image: registry.example.com/club-ops-api:v1.0.0
```

---

## Useful Commands Summary

```bash
make dev              # Start development
make prod             # Start production
make build            # Build all images
make health           # Check service health
make logs             # View all logs
make scan             # Security scan
make down             # Stop all services
make clean            # Stop and remove everything
make db-migrate       # Run database migrations
make db-seed          # Seed demo data
```

For full command list:
```bash
make help
```

---

Generated: 2026-02-14 | Docker Deployment Guide v1.0
