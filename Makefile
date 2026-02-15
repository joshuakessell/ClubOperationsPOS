.PHONY: help build up down logs clean rebuild dev prod health scan

help:
	@echo "Club Operations POS - Docker Commands"
	@echo "======================================="
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start development environment with hot reload"
	@echo "  make dev-logs         View development logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod             Start production environment"
	@echo "  make prod-logs        View production logs"
	@echo ""
	@echo "Building:"
	@echo "  make build            Build all images"
	@echo "  make build-api        Build API image only"
	@echo "  make build-frontends  Build all frontend images"
	@echo "  make rebuild          Force rebuild without cache"
	@echo ""
	@echo "Status & Monitoring:"
	@echo "  make ps               Show running containers"
	@echo "  make health           Check service health status"
	@echo "  make logs             Show all logs"
	@echo ""
	@echo "Cleanup:"
	@echo "  make down             Stop all services"
	@echo "  make clean            Stop and remove containers, volumes"
	@echo "  make prune            Remove unused Docker artifacts"
	@echo ""
	@echo "Security & Analysis:"
	@echo "  make scan             Scan images for vulnerabilities"
	@echo "  make images           Show image sizes"
	@echo ""

# Development
dev:
	docker compose up --pull always

dev-logs:
	docker compose logs -f

# Production
prod:
	docker compose -f docker-compose.prod.yml up -d --pull always

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# Building
build:
	docker compose build

build-api:
	docker build --pull -f Dockerfile.api -t club-ops-api:latest .

build-frontends:
	docker build --pull -f Dockerfile.customer-kiosk -t club-ops-customer-kiosk:latest . && \
	docker build --pull -f Dockerfile.employee-register -t club-ops-employee-register:latest . && \
	docker build --pull -f Dockerfile.office-dashboard -t club-ops-office-dashboard:latest .

rebuild:
	docker compose build --no-cache

# Status & Monitoring
ps:
	docker compose ps

health:
	@echo "=== API Health ===" && \
	docker inspect club-ops-api --format='{{.State.Health.Status}}' || echo "Not running" && \
	echo "" && \
	echo "=== Database Health ===" && \
	docker inspect club-ops-db --format='{{.State.Health.Status}}' || echo "Not running"

logs:
	docker compose logs -f

# Cleanup
down:
	docker compose down

clean:
	docker compose down -v
	docker system prune -f

prune:
	docker system prune -a -f

# Security & Analysis
scan:
	@echo "Scanning club-ops-api for vulnerabilities..." && \
	docker scout cves club-ops-api:latest || echo "Docker Scout not available. Install: docker scout" && \
	echo "" && \
	echo "Scanning club-ops-customer-kiosk for vulnerabilities..." && \
	docker scout cves club-ops-customer-kiosk:latest || echo "Docker Scout not available"

images:
	@docker images | grep club-ops && \
	echo "" && \
	echo "Total size:" && \
	docker images --filter=reference='club-ops*' --format='{{.Size}}' | paste -sd+ | bc

# Database
db-migrate:
	docker compose exec -T api pnpm --filter @club-ops/api db:migrate

db-seed:
	docker compose exec -T api pnpm --filter @club-ops/api seed

db-reset:
	docker compose exec -T api pnpm --filter @club-ops/api db:reset

# Testing
test:
	docker compose exec -T api pnpm test

lint:
	docker compose exec -T api pnpm lint

typecheck:
	docker compose exec -T api pnpm typecheck
