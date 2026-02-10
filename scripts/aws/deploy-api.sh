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
need_cmd docker
need_cmd git
need_cmd pnpm
need_cmd python3

aws sts get-caller-identity >/dev/null

required APP_RUNNER_SERVICE_ARN

USE_DB_SECRET=false
if [[ -n "${DATABASE_URL_SECRET_ARN:-}" ]]; then
  # Normalize accidental whitespace/quotes.
  DATABASE_URL_SECRET_ARN="$(
    printf '%s' "$DATABASE_URL_SECRET_ARN" |
      tr -d '\r\n' |
      sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
  )"
  DATABASE_URL_SECRET_ARN="${DATABASE_URL_SECRET_ARN#\"}"
  DATABASE_URL_SECRET_ARN="${DATABASE_URL_SECRET_ARN%\"}"
  DATABASE_URL_SECRET_ARN="${DATABASE_URL_SECRET_ARN#\'}"
  DATABASE_URL_SECRET_ARN="${DATABASE_URL_SECRET_ARN%\'}"
  USE_DB_SECRET=true
else
  required RDS_SECRET_ARN
  required DB_HOST
  required DB_PORT
  required DB_NAME
  required DB_USER
fi

DB_SSL_VALUE="${DB_SSL:-true}"

# Guard: Postgres DB names should not contain hyphens (only when using explicit DB vars).
if [[ "$USE_DB_SECRET" == "false" ]]; then
  if [[ "$DB_NAME" == *"-"* ]]; then
    echo "ERROR: DB_NAME='$DB_NAME' contains '-' which is not valid for Postgres database names. Use something like club_ops_db." >&2
    exit 1
  fi
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_URI="${ECR_REPO_URI:-146469921099.dkr.ecr.us-east-1.amazonaws.com/club-ops-api}"

IMAGE_TAG_SHA="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD)"
IMAGE_SHA_TAG="${ECR_REPO_URI}:${IMAGE_TAG_SHA}"
IMAGE_LATEST_TAG="${ECR_REPO_URI}:dev-latest"
export IMAGE_LATEST_TAG

aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${ECR_REPO_URI%/*}"

cd "$ROOT_DIR"

if [[ "${SKIP_PNPM_INSTALL:-}" != "true" ]]; then
  pnpm install --frozen-lockfile
fi

# Build outputs needed by the Dockerfile (prebuilt dist copy)
pnpm turbo run build --filter @club-ops/shared --filter @club-ops/api

# Dockerfile expects dist outputs to exist and be included in context (ensure .dockerignore allows them)
docker build -t "$IMAGE_SHA_TAG" -f services/api/Dockerfile .
docker tag "$IMAGE_SHA_TAG" "$IMAGE_LATEST_TAG"

docker push "$IMAGE_SHA_TAG"
docker push "$IMAGE_LATEST_TAG"

# Fetch DB password from Secrets Manager (never stored in GitHub)
if [[ "$USE_DB_SECRET" == "false" ]]; then
  DB_PASSWORD_FROM_SM="$(
    aws secretsmanager get-secret-value \
      --secret-id "$RDS_SECRET_ARN" \
      --query SecretString \
      --output text | python3 -c 'import json,sys; print(json.load(sys.stdin)["password"])'
  )"

  # URL-encode password to safely handle special characters.
  DB_PASSWORD_URLENCODED="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$DB_PASSWORD_FROM_SM")"

  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_URLENCODED}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"
  echo "DB target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} (password redacted)"
fi

MIGRATION_DATABASE_URL=""
if [[ "$USE_DB_SECRET" == "true" ]]; then
  MIGRATION_DATABASE_URL="$(
    aws secretsmanager get-secret-value \
      --secret-id "$DATABASE_URL_SECRET_ARN" \
      --query SecretString \
      --output text
  )"
else
  MIGRATION_DATABASE_URL="$DATABASE_URL"
fi

if [[ "${SKIP_DB_MIGRATIONS:-}" != "true" ]]; then
  echo "Running DB migrations..."
  (
    cd "$ROOT_DIR/services/api"
    DATABASE_URL="$MIGRATION_DATABASE_URL" \
    DB_SSL="$DB_SSL_VALUE" \
    DB_SSL_CA_PATH="${DB_SSL_CA_PATH:-}" \
      pnpm exec tsx scripts/migrate.ts
  )
fi

if [[ "${DEMO_MODE:-}" == "true" && "${SKIP_DEMO_SEED:-}" != "true" ]]; then
  : "${DEMO_INCREMENTAL:=true}"
  : "${DEMO_RESET_ON_STARTUP:=true}"
  : "${DEMO_SHIFT_REGENERATE_PDFS:=true}"
  DEMO_FORCE_RESEED_VALUE="${DEMO_FORCE_RESEED:-false}"
  echo "Running demo seed (incremental=$DEMO_INCREMENTAL)..."
  (
    cd "$ROOT_DIR/services/api"
    DEMO_MODE=true \
    DEMO_INCREMENTAL="$DEMO_INCREMENTAL" \
    DEMO_RESET_ON_STARTUP="$DEMO_RESET_ON_STARTUP" \
    DEMO_FORCE_RESEED="$DEMO_FORCE_RESEED_VALUE" \
    DEMO_SHIFT_REGENERATE_PDFS="$DEMO_SHIFT_REGENERATE_PDFS" \
    DATABASE_URL="$MIGRATION_DATABASE_URL" \
    DB_SSL="$DB_SSL_VALUE" \
    DB_SSL_CA_PATH="${DB_SSL_CA_PATH:-}" \
      pnpm exec tsx src/db/seed-demo.ts
  )
fi

if [[ "${SKIP_DB_VERIFY:-}" != "true" ]]; then
  echo "Verifying DB schema..."
  (
    cd "$ROOT_DIR/services/api"
    DATABASE_URL="$MIGRATION_DATABASE_URL" \
    DB_SSL="$DB_SSL_VALUE" \
    DB_SSL_CA_PATH="${DB_SSL_CA_PATH:-}" \
      node - <<'NODE'
const fs = require('node:fs');
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
const sslEnabled = process.env.DB_SSL === 'true';
const sslCaPath = process.env.DB_SSL_CA_PATH;
const ssl = sslEnabled
  ? sslCaPath
    ? { ca: fs.readFileSync(sslCaPath, 'utf8'), rejectUnauthorized: true }
    : { rejectUnauthorized: false }
  : undefined;

const client = new Client({ connectionString, ssl });

(async () => {
  try {
    await client.connect();
    const res = await client.query(
      "SELECT to_regclass('public.lane_sessions') AS lane_sessions, to_regclass('public.waitlist') AS waitlist, to_regclass('public.rooms') AS rooms"
    );
    const row = res.rows[0] || {};
    console.log('Schema check:', row);
    const missing = ['lane_sessions', 'waitlist', 'rooms'].filter((key) => !row[key]);
    if (missing.length > 0) {
      console.error(`Missing tables: ${missing.join(', ')}`);
      process.exit(1);
    }
  } catch (error) {
    const message = error && error.message ? error.message : error;
    console.error('DB schema verification failed:', message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
NODE
  )
fi

# Read existing App Runner runtime secrets (optional)
EXISTING_SECRET_KEYS="$(
  aws apprunner describe-service \
    --service-arn "$APP_RUNNER_SERVICE_ARN" \
    --query 'Service.SourceConfiguration.ImageRepository.ImageConfiguration.RuntimeEnvironmentSecrets | keys(@)' \
    --output text 2>/dev/null || true
)"

has_secret() {
  local key="$1"
  if [[ -z "$EXISTING_SECRET_KEYS" || "$EXISTING_SECRET_KEYS" == "None" ]]; then
    return 1
  fi
  grep -qw "$key" <<<"$EXISTING_SECRET_KEYS"
}

USE_KIOSK_SECRET=false
if [[ -n "${KIOSK_TOKEN_SECRET_ARN:-}" ]]; then
  # Normalize accidental whitespace/quotes.
  KIOSK_TOKEN_SECRET_ARN="$(
    printf '%s' "$KIOSK_TOKEN_SECRET_ARN" |
      tr -d '\r\n' |
      sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
  )"
  KIOSK_TOKEN_SECRET_ARN="${KIOSK_TOKEN_SECRET_ARN#\"}"
  KIOSK_TOKEN_SECRET_ARN="${KIOSK_TOKEN_SECRET_ARN%\"}"
  KIOSK_TOKEN_SECRET_ARN="${KIOSK_TOKEN_SECRET_ARN#\'}"
  KIOSK_TOKEN_SECRET_ARN="${KIOSK_TOKEN_SECRET_ARN%\'}"
  USE_KIOSK_SECRET=true
fi

# Require KIOSK_TOKEN only if it's not already configured as a runtime secret
if [[ "$USE_KIOSK_SECRET" == "false" ]]; then
  if ! has_secret "KIOSK_TOKEN"; then
    required KIOSK_TOKEN
  fi
fi

runtime_env_vars=(
  "PORT=3000"
  "HOST=0.0.0.0"
)

if [[ "$USE_DB_SECRET" == "false" ]]; then
  runtime_env_vars+=("DATABASE_URL=${DATABASE_URL}")
fi

runtime_env_vars+=("DB_SSL=${DB_SSL_VALUE}")

if [[ "$USE_KIOSK_SECRET" == "false" ]] && ! has_secret "KIOSK_TOKEN"; then
  runtime_env_vars+=("KIOSK_TOKEN=${KIOSK_TOKEN}")
fi

if [[ -n "${LOG_LEVEL:-}" ]]; then
  runtime_env_vars+=("LOG_LEVEL=${LOG_LEVEL}")
fi

optional_envs=(
  DEMO_MODE
  SEED_ON_STARTUP
  DEMO_INCREMENTAL
  DEMO_FORCE_RESEED
  DEMO_RESET_ON_STARTUP
  DEMO_SHIFT_REGENERATE_PDFS
  APPSYNC_EVENTS_HTTP_ENDPOINT
  APPSYNC_EVENTS_CHANNEL_NAMESPACE
  DB_LOG_QUERIES
  DB_SSL_CA_PATH
)

for key in "${optional_envs[@]}"; do
  if [[ -n "${!key:-}" ]]; then
    runtime_env_vars+=("${key}=${!key}")
  fi
done

runtime_env_secrets=()
if [[ "$USE_DB_SECRET" == "true" ]]; then
  runtime_env_secrets+=("DATABASE_URL=${DATABASE_URL_SECRET_ARN}")
fi
if [[ "$USE_KIOSK_SECRET" == "true" ]]; then
  runtime_env_secrets+=("KIOSK_TOKEN=${KIOSK_TOKEN_SECRET_ARN}")
fi

TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

RUNTIME_ENV_VARS="$(printf '%s\n' "${runtime_env_vars[@]}")"
RUNTIME_ENV_SECRETS="$(printf '%s\n' "${runtime_env_secrets[@]}")"
export RUNTIME_ENV_VARS
export RUNTIME_ENV_SECRETS

python3 - <<'PY' > "$TMP_JSON"
import json
import os
import sys

def parse_pairs(raw: str) -> dict:
    data = {}
    for line in raw.splitlines():
        if not line:
            continue
        key, value = line.split("=", 1)
        data[key] = value
    return data

env_vars = parse_pairs(os.environ.get("RUNTIME_ENV_VARS", ""))
env_secrets = parse_pairs(os.environ.get("RUNTIME_ENV_SECRETS", ""))

payload = {
    "ServiceArn": os.environ["APP_RUNNER_SERVICE_ARN"],
    "SourceConfiguration": {
        "ImageRepository": {
            "ImageIdentifier": os.environ["IMAGE_LATEST_TAG"],
            "ImageRepositoryType": "ECR",
            "ImageConfiguration": {
                "Port": "3000",
                "RuntimeEnvironmentVariables": env_vars,
            },
        },
        "AutoDeploymentsEnabled": False,
    },
}

if env_secrets:
    payload["SourceConfiguration"]["ImageRepository"]["ImageConfiguration"][
        "RuntimeEnvironmentSecrets"
    ] = env_secrets

json.dump(payload, sys.stdout)
PY

aws apprunner update-service --cli-input-json file://"$TMP_JSON"

# Wait for App Runner to become RUNNING
for i in {1..60}; do
  status="$(aws apprunner describe-service --service-arn "$APP_RUNNER_SERVICE_ARN" --query 'Service.Status' --output text)"
  echo "App Runner status: $status"
  if [[ "$status" == "RUNNING" ]]; then
    break
  fi
  if [[ "$status" == "CREATE_FAILED" || "$status" == "DELETE_FAILED" || "$status" == "OPERATION_FAILED" ]]; then
    echo "ERROR: App Runner entered failure state: $status" >&2
    exit 1
  fi
  sleep 10
done

echo "✓ App Runner update submitted for ${APP_RUNNER_SERVICE_ARN}"
