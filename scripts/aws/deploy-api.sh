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
required DATABASE_URL_SECRET_ARN
required KIOSK_TOKEN_SECRET_ARN
required AWS_REGION
required ECR_REPO_URI
required DB_SSL
required IMAGE_TAG

DB_SSL_VALUE="$DB_SSL"

IMAGE_SHA_TAG="${ECR_REPO_URI}:${IMAGE_TAG}"
IMAGE_LATEST_TAG="${ECR_REPO_URI}:dev-latest"
export IMAGE_LATEST_TAG
DEPLOY_IMAGE_TAG="$IMAGE_SHA_TAG"
export DEPLOY_IMAGE_TAG

PUSH_DEV_LATEST_TAG="${PUSH_DEV_LATEST_TAG:-false}"

aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${ECR_REPO_URI%/*}"

cd "$ROOT_DIR"

required SKIP_PNPM_INSTALL
if [[ "$SKIP_PNPM_INSTALL" != "true" ]]; then
  pnpm install --frozen-lockfile
fi

# Build outputs needed by the Dockerfile (prebuilt dist copy)
pnpm turbo run build --filter @club-ops/shared --filter @club-ops/api

# Dockerfile expects dist outputs to exist and be included in context (ensure .dockerignore allows them)
docker build -t "$IMAGE_SHA_TAG" -f services/api/Dockerfile .

docker push "$IMAGE_SHA_TAG"

# NOTE: We intentionally do not attempt an immediate post-push `docker manifest inspect`.
# GitHub Actions runners + ECR auth can intermittently return 403/401 for manifest
# HEAD/GET calls right after a push (even though the push succeeded), which makes
# deployments flaky. App Runner will pull by tag during `update-service`.

if [[ "$PUSH_DEV_LATEST_TAG" == "true" ]]; then
  docker tag "$IMAGE_SHA_TAG" "$IMAGE_LATEST_TAG"
  docker push "$IMAGE_LATEST_TAG"
fi

MIGRATION_DATABASE_URL="$(
  aws secretsmanager get-secret-value \
    --secret-id "$DATABASE_URL_SECRET_ARN" \
    --query SecretString \
    --output text
)"

required SKIP_DB_MIGRATIONS
if [[ "$SKIP_DB_MIGRATIONS" != "true" ]]; then
  echo "Running DB migrations..."
  (
    cd "$ROOT_DIR/services/api"
    DATABASE_URL="$MIGRATION_DATABASE_URL" \
    DB_SSL="$DB_SSL_VALUE" \
    DB_SSL_CA_PATH="${DB_SSL_CA_PATH:-}" \
      pnpm exec tsx scripts/migrate.ts
  )
fi

required DEMO_MODE
required SKIP_DEMO_SEED
required DEMO_INCREMENTAL
required DEMO_RESET_ON_STARTUP
required DEMO_SHIFT_REGENERATE_PDFS
required DEMO_FORCE_RESEED

if [[ "$DEMO_MODE" == "true" && "$SKIP_DEMO_SEED" != "true" ]]; then
  DEMO_FORCE_RESEED_VALUE="$DEMO_FORCE_RESEED"
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

required SKIP_DB_VERIFY
if [[ "$SKIP_DB_VERIFY" != "true" ]]; then
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

required KIOSK_TOKEN_SECRET_ARN

runtime_env_vars=(
  "PORT=3000"
  "HOST=0.0.0.0"
)

runtime_env_vars+=("DB_SSL=${DB_SSL_VALUE}")

required LOG_LEVEL
required SEED_ON_STARTUP
required APPSYNC_EVENTS_HTTP_ENDPOINT
required APPSYNC_EVENTS_CHANNEL_NAMESPACE
required DB_LOG_QUERIES
required_set DB_SSL_CA_PATH

runtime_env_vars+=("LOG_LEVEL=${LOG_LEVEL}")
runtime_env_vars+=("DEMO_MODE=${DEMO_MODE}")
runtime_env_vars+=("SEED_ON_STARTUP=${SEED_ON_STARTUP}")
runtime_env_vars+=("DEMO_INCREMENTAL=${DEMO_INCREMENTAL}")
runtime_env_vars+=("DEMO_FORCE_RESEED=${DEMO_FORCE_RESEED}")
runtime_env_vars+=("DEMO_RESET_ON_STARTUP=${DEMO_RESET_ON_STARTUP}")
runtime_env_vars+=("DEMO_SHIFT_REGENERATE_PDFS=${DEMO_SHIFT_REGENERATE_PDFS}")
runtime_env_vars+=("APPSYNC_EVENTS_HTTP_ENDPOINT=${APPSYNC_EVENTS_HTTP_ENDPOINT}")
runtime_env_vars+=("APPSYNC_EVENTS_CHANNEL_NAMESPACE=${APPSYNC_EVENTS_CHANNEL_NAMESPACE}")
runtime_env_vars+=("DB_LOG_QUERIES=${DB_LOG_QUERIES}")
runtime_env_vars+=("DB_SSL_CA_PATH=${DB_SSL_CA_PATH}")

runtime_env_secrets=(
  "DATABASE_URL=${DATABASE_URL_SECRET_ARN}"
  "KIOSK_TOKEN=${KIOSK_TOKEN_SECRET_ARN}"
)

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
            "ImageIdentifier": os.environ["DEPLOY_IMAGE_TAG"],
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
