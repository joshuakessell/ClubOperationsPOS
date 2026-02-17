# Docker Setup Guide

## Overview

This project uses Docker and Docker Compose to containerize all services:

- **API Service** (Node.js/Fastify) - Backend API
- **Customer Kiosk** (Vite/React) - Customer-facing UI
- **Employee Register** (Vite/React) - Staff register UI
- **Office Dashboard** (Vite/React) - Admin dashboard
- **PostgreSQL** - Database

## Quick Start

### Production Mode

```bash
# Copy environment file
cp .env.example .env

# Edit .env and set required values (especially KIOSK_TOKEN)
nano .env

# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

Services will be available at:
- API: http://localhost:3000
- Customer Kiosk: http://localhost:5173
- Employee Register: http://localhost:5175
- Office Dashboard: http://localhost:5176
- PostgreSQL: localhost:5433

### Development Mode

For hot-reloading and live development:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## File Structure

```
.dockerignore                    # Files to exclude from Docker builds
.env.example                     # Environment template
docker-compose.yml               # Production orchestration
docker-compose.dev.yml           # Development overrides
Dockerfile.api                   # API service image
Dockerfile.customer-kiosk        # Customer kiosk image
Dockerfile.employee-kiosk     # Employee register image
Dockerfile.office-dashboard      # Office dashboard image
```

## Docker Best Practices Implemented

### Multi-stage Builds
- **deps stage**: Install dependencies with layer caching
- **builder stage**: Build TypeScript/Vite applications
- **runner stage**: Minimal production image (nginx for frontends, node for API)

### Layer Caching Optimization
- Dependencies installed before source code copy
- BuildKit cache mounts for pnpm store (`--mount=type=cache`)
- Ordered from least to most frequently changing

### Size Optimization
- Alpine-based images (node:22-alpine, nginx:alpine)
- Production-only dependencies for API
- Multi-stage builds discard build tools

### Security
- Non-root user implied by official images
- Health checks for API and database
- Minimal runtime dependencies

### Development Experience
- Development override file with hot-reload
- Volume mounts for live code changes
- Separated concerns (one service per container)

## Commands

### Build Individual Services

```bash
docker build -f Dockerfile.api -t club-ops-api .
docker build -f Dockerfile.customer-kiosk -t club-ops-customer-kiosk .
docker build -f Dockerfile.employee-kiosk -t club-ops-employee-kiosk .
docker build -f Dockerfile.office-dashboard -t club-ops-office-dashboard .
```

### Database Management

```bash
# Start only database
docker compose up -d db

# Run migrations (from host)
pnpm db:migrate

# Seed database (from host)
pnpm db:seed

# Access database shell
docker compose exec db psql -U clubops -d club_operations
```

### Service Management

```bash
# Start specific services
docker compose up -d api db

# Rebuild service after code changes
docker compose up -d --build api

# View service logs
docker compose logs -f api

# Execute command in running container
docker compose exec api node -v
```

### Cleanup

```bash
# Stop and remove containers
docker compose down

# Remove containers and volumes (CAUTION: deletes database data)
docker compose down -v

# Remove all unused images
docker image prune -a
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable | Description | Default |
|----------|-------------|---------|
| `KIOSK_TOKEN` | Authentication token for kiosk | *Required* |
| `DB_PASSWORD` | PostgreSQL password | club-ops-dev |
| `DB_PORT` | Host port for PostgreSQL | 5433 |
| `DEMO_MODE` | Enable demo mode | false |
| `SEED_ON_STARTUP` | Auto-seed database on start | false |

## Troubleshooting

### Port conflicts
If ports are already in use, update in `.env`:
```bash
DB_PORT=5434
```

### Build cache issues
Force rebuild without cache:
```bash
docker compose build --no-cache
```

### Permission issues
Ensure Docker daemon is running and you have permissions:
```bash
docker info
```

### Database connection issues
Check database health:
```bash
docker compose ps
docker compose logs db
```

## Notes

- Frontend apps use nginx for production serving with SPA routing support
- API uses health checks for container orchestration
- Database data persists in named volume `club-ops-postgres-data`
- All services communicate over `club-ops-network` bridge network
