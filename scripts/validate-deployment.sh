#!/bin/bash
set -e

# Pre-deployment validation script
# Usage: ./scripts/validate-deployment.sh [staging|production]

ENVIRONMENT=${1:-staging}
REPO_NAME="club-operations-pos"

echo "🔍 Pre-deployment validation for $ENVIRONMENT"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi
echo "✅ Docker available"

# Check docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose."
    exit 1
fi
echo "✅ docker-compose available"

# Verify required files
required_files=(
    "Dockerfile.api"
    "Dockerfile.customer-kiosk"
    "Dockerfile.employee-kiosk"
    "Dockerfile.office-dashboard"
    "docker-compose.production.yml"
    ".env.$ENVIRONMENT"
)

echo ""
echo "Checking required files..."
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
    echo "✅ $file"
done

# Verify environment variables
echo ""
echo "Checking environment configuration..."
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo "❌ Environment file not found: .env.$ENVIRONMENT"
    exit 1
fi
echo "✅ Environment file loaded"

# Check for required secrets
required_vars=("KIOSK_TOKEN" "DB_PASSWORD" "VITE_API_BASE_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" ".env.$ENVIRONMENT"; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing environment variables: ${missing_vars[*]}"
    exit 1
fi
echo "✅ All required environment variables present"

# Validate Docker image builds locally
echo ""
echo "Building Docker images (this may take a few minutes)..."

services=("api" "customer-kiosk" "employee-kiosk" "office-dashboard")
for service in "${services[@]}"; do
    echo "  Building $service..."
    if ! docker build -f "Dockerfile.$service" -t "club-ops-$service:test" . > /dev/null 2>&1; then
        echo "❌ Failed to build Docker image for $service"
        exit 1
    fi
    echo "  ✅ $service"
done

# Dry run docker-compose
echo ""
echo "Running docker-compose validation..."
if ! docker-compose -f docker-compose.production.yml config > /dev/null 2>&1; then
    echo "❌ docker-compose configuration is invalid"
    exit 1
fi
echo "✅ docker-compose configuration valid"

# Check disk space
echo ""
echo "Checking system resources..."
available_space=$(df . | awk 'NR==2 {print $4}')
if [ "$available_space" -lt 5242880 ]; then  # 5GB in KB
    echo "⚠️  Low disk space available: $(numfmt --to=iec $((available_space * 1024))) (recommend at least 5GB)"
fi
echo "✅ Sufficient disk space"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Pre-deployment validation passed for $ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Ready to deploy. Next steps:"
echo "  1. Review .env.$ENVIRONMENT configuration"
echo "  2. Run: docker-compose -f docker-compose.production.yml up -d"
echo "  3. Monitor: docker-compose logs -f"
echo ""
