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
required RDS_SECRET_ARN
required DB_HOST
required DB_PORT
required DB_NAME
required DB_USER

# Guard: Postgres DB names should not contain hyphens
if [[ "$DB_NAME" == *"-"* ]]; then
  echo "ERROR: DB_NAME='$DB_NAME' contains '-' which is not valid for Postgres database names. Use something like club_ops_db." >&2
  exit 1
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_URI="${ECR_REPO_URI:-146469921099.dkr.ecr.us-east-1.amazonaws.com/club-ops-api}"

IMAGE_TAG_SHA="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD)"
IMAGE_SHA_TAG="${ECR_REPO_URI}:${IMAGE_TAG_SHA}"
IMAGE_LATEST_TAG="${ECR_REPO_URI}:dev-latest"

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
DB_PASSWORD_FROM_SM="$(
  aws secretsmanager get-secret-value \
    --secret-id "$RDS_SECRET_ARN" \
    --query SecretString \
    --output text | python3 -c 'import json,sys; print(json.load(sys.stdin)["password"])'
)"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_FROM_SM}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"
echo "DB target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} (password redacted)"

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

# Require KIOSK_TOKEN only if it's not already configured as a runtime secret
if ! has_secret "KIOSK_TOKEN"; then
  required KIOSK_TOKEN
fi

runtime_env_vars=(
  "PORT=3000"
  "HOST=0.0.0.0"
  "DATABASE_URL=${DATABASE_URL}"
)

if ! has_secret "KIOSK_TOKEN"; then
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
  DB_LOG_QUERIES
  DB_SSL
  DB_SSL_CA_PATH
)

for key in "${optional_envs[@]}"; do
  if [[ -n "${!key:-}" ]]; then
    runtime_env_vars+=("${key}=${!key}")
  fi
done

TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

cat > "$TMP_JSON" <<JSON
{
  "ServiceArn": "${APP_RUNNER_SERVICE_ARN}",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "${IMAGE_LATEST_TAG}",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
JSON

first=1
for kv in "${runtime_env_vars[@]}"; do
  key="${kv%%=*}"
  val="${kv#*=}"
  if [[ $first -eq 0 ]]; then
    echo "," >> "$TMP_JSON"
  fi
  first=0
  printf '          "%s": "%s"' "$key" "$val" >> "$TMP_JSON"
done

echo "" >> "$TMP_JSON"
cat >> "$TMP_JSON" <<JSON
        }
      }
    },
    "AutoDeploymentsEnabled": false
  }
}
JSON

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