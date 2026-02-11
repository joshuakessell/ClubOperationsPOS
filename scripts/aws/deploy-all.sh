#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

required() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: $name is required" >&2
    exit 1
  fi
}

required_set() {
  local name="$1"
  if [[ -z "${!name+x}" ]]; then
    echo "ERROR: $name must be set" >&2
    exit 1
  fi
}

# API deploy env
required APP_RUNNER_SERVICE_ARN
required DATABASE_URL_SECRET_ARN
required KIOSK_TOKEN_SECRET_ARN
required AWS_REGION
required ECR_REPO_URI
required DB_SSL

required_set DB_SSL_CA_PATH
required DB_LOG_QUERIES
required LOG_LEVEL
required SEED_ON_STARTUP
required APPSYNC_EVENTS_HTTP_ENDPOINT
required APPSYNC_EVENTS_CHANNEL_NAMESPACE
required SKIP_PNPM_INSTALL
required SKIP_DB_MIGRATIONS
required SKIP_DEMO_SEED
required SKIP_DB_VERIFY
required DEMO_MODE
required DEMO_INCREMENTAL
required DEMO_RESET_ON_STARTUP
required DEMO_SHIFT_REGENERATE_PDFS
required DEMO_FORCE_RESEED

# Employee deploy env
required EMPLOYEE_BUCKET
required EMPLOYEE_DISTRIBUTION_ID

# Customer deploy env
required CUSTOMER_BUCKET
required CUSTOMER_DISTRIBUTION_ID

# Frontend shared env
required VITE_API_BASE_URL
required VITE_REALTIME_PROVIDER
required VITE_REALTIME_CHANNEL_NAMESPACE
required VITE_DISABLE_WS

"$ROOT_DIR/scripts/aws/deploy-api.sh"
"$ROOT_DIR/scripts/aws/deploy-employee-register.sh"
"$ROOT_DIR/scripts/aws/deploy-customer-kiosk.sh"
