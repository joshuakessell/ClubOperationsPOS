#!/usr/bin/env bash
set -euo pipefail

# Docker management script for Club Operations POS
# Usage: ./docker.sh [command]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

function log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

function log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

function check_env() {
    if [ ! -f .env ]; then
        log_warn ".env file not found. Creating from .env.example..."
        cp .env.example .env
        log_info "Please edit .env and set required values (especially KIOSK_TOKEN)"
        exit 1
    fi
}

function build_all() {
    log_info "Building all Docker images..."
    docker compose build "$@"
}

function build_api() {
    log_info "Building API image..."
    docker build -f Dockerfile.api -t club-ops-api .
}

function build_frontends() {
    log_info "Building frontend images..."
    docker build -f Dockerfile.customer-kiosk -t club-ops-customer-kiosk \
        --build-arg VITE_KIOSK_TOKEN="${VITE_KIOSK_TOKEN:-}" .
    docker build -f Dockerfile.employee-kiosk -t club-ops-employee-kiosk \
        --build-arg VITE_KIOSK_TOKEN="${VITE_KIOSK_TOKEN:-}" .
    docker build -f Dockerfile.office-dashboard -t club-ops-office-dashboard \
        --build-arg VITE_KIOSK_TOKEN="${VITE_KIOSK_TOKEN:-}" .
}

function start_prod() {
    check_env
    log_info "Starting all services in production mode..."
    docker compose up -d
    log_info "Services started. Access at:"
    log_info "  API: http://localhost:3000"
    log_info "  Customer Kiosk: http://localhost:5173"
    log_info "  Employee Register: http://localhost:5175"
    log_info "  Office Dashboard: http://localhost:5176"
}

function start_dev() {
    check_env
    log_info "Starting all services in development mode..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
}

function stop() {
    log_info "Stopping all services..."
    docker compose down
}

function restart() {
    stop
    start_prod
}

function logs() {
    docker compose logs -f "${@:-}"
}

function shell() {
    local service="${1:-api}"
    log_info "Opening shell in $service container..."
    docker compose exec "$service" sh
}

function db_shell() {
    log_info "Opening PostgreSQL shell..."
    docker compose exec db psql -U clubops -d club_operations
}

function migrate() {
    log_info "Running database migrations..."
    # Run migrations from host using pnpm
    pnpm db:migrate
}

function seed() {
    log_info "Seeding database..."
    pnpm db:seed
}

function clean() {
    log_warn "This will remove all containers, volumes, and images. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "Cleaning up Docker resources..."
        docker compose down -v
        docker image rm -f club-ops-api club-ops-customer-kiosk club-ops-employee-kiosk club-ops-office-dashboard 2>/dev/null || true
        log_info "Cleanup complete"
    else
        log_info "Cancelled"
    fi
}

function status() {
    log_info "Service status:"
    docker compose ps
}

function help() {
    cat <<EOF
Docker Management Script for Club Operations POS

Usage: ./docker.sh [command]

Commands:
  build              Build all Docker images
  build:api          Build only API image
  build:frontends    Build only frontend images
  
  start              Start all services (production mode)
  dev                Start all services (development mode with hot-reload)
  stop               Stop all services
  restart            Restart all services
  
  logs [service]     View logs (all services or specific service)
  status             Show status of all services
  
  shell [service]    Open shell in container (default: api)
  db:shell           Open PostgreSQL shell
  db:migrate         Run database migrations
  db:seed            Seed database with sample data
  
  clean              Remove all containers, volumes, and images
  help               Show this help message

Examples:
  ./docker.sh start              # Start all services
  ./docker.sh logs api           # View API logs
  ./docker.sh shell api          # Open shell in API container
  ./docker.sh db:migrate         # Run migrations

EOF
}

# Main command router
case "${1:-help}" in
    build)
        shift
        build_all "$@"
        ;;
    build:api)
        build_api
        ;;
    build:frontends)
        build_frontends
        ;;
    start)
        start_prod
        ;;
    dev)
        start_dev
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        shift
        logs "$@"
        ;;
    status)
        status
        ;;
    shell)
        shift
        shell "$@"
        ;;
    db:shell)
        db_shell
        ;;
    db:migrate)
        migrate
        ;;
    db:seed)
        seed
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        help
        ;;
    *)
        log_error "Unknown command: $1"
        help
        exit 1
        ;;
esac
