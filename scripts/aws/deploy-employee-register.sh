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

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing required tool '$1'" >&2
    exit 1
  }
}

need_cmd aws
need_cmd pnpm

aws sts get-caller-identity >/dev/null

required VITE_KIOSK_TOKEN
required EMPLOYEE_BUCKET
required EMPLOYEE_DISTRIBUTION_ID

VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api-demo.joshuakessell.com}"
VITE_REALTIME_PROVIDER="${VITE_REALTIME_PROVIDER:-appsync-events}"
VITE_REALTIME_CHANNEL_NAMESPACE="${VITE_REALTIME_CHANNEL_NAMESPACE:-club-ops}"
VITE_DISABLE_WS="${VITE_DISABLE_WS:-false}"

cd "$ROOT_DIR"

if [[ "${SKIP_PNPM_INSTALL:-}" != "true" ]]; then
  pnpm install --frozen-lockfile
fi

VITE_API_BASE_URL="$VITE_API_BASE_URL" \
VITE_KIOSK_TOKEN="$VITE_KIOSK_TOKEN" \
VITE_REALTIME_PROVIDER="$VITE_REALTIME_PROVIDER" \
VITE_REALTIME_CHANNEL_NAMESPACE="$VITE_REALTIME_CHANNEL_NAMESPACE" \
VITE_DISABLE_WS="$VITE_DISABLE_WS" \
  pnpm turbo run build --filter @club-ops/employee-register --force

aws s3 sync apps/employee-register/dist "s3://${EMPLOYEE_BUCKET}" --delete
aws cloudfront create-invalidation --distribution-id "$EMPLOYEE_DISTRIBUTION_ID" --paths "/*"

echo "✓ Deployed employee-register"
