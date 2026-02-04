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
need_cmd python3

SESSION_MANAGER_PLUGIN="${SESSION_MANAGER_PLUGIN:-session-manager-plugin}"
if ! command -v "$SESSION_MANAGER_PLUGIN" >/dev/null 2>&1; then
  if [[ -x "${HOME}/.local/bin/session-manager-plugin" ]]; then
    SESSION_MANAGER_PLUGIN="${HOME}/.local/bin/session-manager-plugin"
  else
    echo "ERROR: session-manager-plugin not found in PATH or ~/.local/bin." >&2
    exit 1
  fi
fi

BASTION_INSTANCE_ID="${BASTION_INSTANCE_ID:-i-01f7806cad897d3ee}"
RDS_ENDPOINT="${RDS_ENDPOINT:-club-ops-dev-db.cobu0oqcipf5.us-east-1.rds.amazonaws.com}"
RDS_PORT="${RDS_PORT:-5432}"
LOCAL_PORT="${LOCAL_PORT:-5433}"

DEMO_INCREMENTAL="${DEMO_INCREMENTAL:-true}"
DEMO_RESET_ON_STARTUP="${DEMO_RESET_ON_STARTUP:-true}"
DEMO_FORCE_RESEED="${DEMO_FORCE_RESEED:-false}"
DEMO_SHIFT_REGENERATE_PDFS="${DEMO_SHIFT_REGENERATE_PDFS:-true}"

STOP_INSTANCE_ON_EXIT="${STOP_INSTANCE_ON_EXIT:-true}"
SKIP_DB_MIGRATIONS="${SKIP_DB_MIGRATIONS:-}"

DATABASE_URL_FOR_TUNNEL=""
if [[ -n "${DATABASE_URL_SECRET_ARN:-}" ]]; then
  SECRET_STRING="$(
    aws secretsmanager get-secret-value \
      --secret-id "$DATABASE_URL_SECRET_ARN" \
      --query SecretString \
      --output text
  )"

  DATABASE_URL_FOR_TUNNEL="$(
    printf '%s' "$SECRET_STRING" | python3 - "$LOCAL_PORT" <<'PY'
import json
import os
import sys
import urllib.parse

raw = sys.stdin.read().strip()
local_port = sys.argv[1]

def build_url(user: str, password: str, dbname: str) -> str:
    user_enc = urllib.parse.quote(user or "")
    pass_enc = urllib.parse.quote(password or "")
    auth = ""
    if user_enc or pass_enc:
        auth = f"{user_enc}:{pass_enc}@"
    return f"postgresql://{auth}localhost:{local_port}/{dbname}"

if raw.startswith("postgres://") or raw.startswith("postgresql://"):
    url = urllib.parse.urlparse(raw)
    user = urllib.parse.unquote(url.username or "")
    password = urllib.parse.unquote(url.password or "")
    dbname = (url.path or "").lstrip("/") or os.environ.get("DB_NAME", "club_operations")
    print(build_url(user, password, dbname))
    sys.exit(0)

try:
    data = json.loads(raw)
except Exception:
    sys.stderr.write("ERROR: SecretString is neither a connection string nor JSON.\n")
    sys.exit(1)

user = data.get("username") or data.get("user") or os.environ.get("DB_USER", "clubops")
password = data.get("password", "")
dbname = data.get("dbname") or data.get("database") or os.environ.get("DB_NAME", "club_operations")

print(build_url(user, password, dbname))
PY
  )"
  echo "Using DATABASE_URL from Secrets Manager (host forced to localhost:${LOCAL_PORT})."
fi

LOG_PATH="${LOG_PATH:-/tmp/ssm-tunnel.log}"
TUNNEL_PID=""

if [[ "${SKIP_PNPM_INSTALL:-}" != "true" ]]; then
  echo "Installing dependencies..."
  (cd "$ROOT_DIR" && pnpm install --frozen-lockfile)
fi

dump_log() {
  if [[ -f "$LOG_PATH" ]]; then
    echo "---- SSM tunnel log (${LOG_PATH}) ----" >&2
    tail -n 200 "$LOG_PATH" >&2 || true
    echo "--------------------------------------" >&2
  else
    echo "SSM tunnel log not found at ${LOG_PATH}" >&2
  fi
}

cleanup() {
  if [[ -n "${TUNNEL_PID:-}" ]]; then
    kill "$TUNNEL_PID" >/dev/null 2>&1 || true
  fi
  if [[ "$STOP_INSTANCE_ON_EXIT" == "true" ]]; then
    aws ec2 stop-instances --instance-ids "$BASTION_INSTANCE_ID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

aws sts get-caller-identity >/dev/null

echo "Ensuring bastion is running: ${BASTION_INSTANCE_ID}"
state="$(aws ec2 describe-instances --instance-ids "$BASTION_INSTANCE_ID" --query 'Reservations[0].Instances[0].State.Name' --output text)"
if [[ "$state" != "running" ]]; then
  aws ec2 start-instances --instance-ids "$BASTION_INSTANCE_ID" >/dev/null
  aws ec2 wait instance-running --instance-ids "$BASTION_INSTANCE_ID"
fi

echo "Waiting for SSM registration..."
for i in {1..30}; do
  id="$(aws ssm describe-instance-information --filters Key=InstanceIds,Values="$BASTION_INSTANCE_ID" --query 'InstanceInformationList[0].InstanceId' --output text 2>/dev/null || true)"
  if [[ "$id" == "$BASTION_INSTANCE_ID" ]]; then
    break
  fi
  sleep 5
done

echo "Starting SSM tunnel localhost:${LOCAL_PORT} -> ${RDS_ENDPOINT}:${RDS_PORT}"
PATH="$(dirname "$SESSION_MANAGER_PLUGIN"):$PATH" \
  nohup aws ssm start-session \
    --target "$BASTION_INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "{\"host\":[\"${RDS_ENDPOINT}\"],\"portNumber\":[\"${RDS_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}" \
    > "$LOG_PATH" 2>&1 &

TUNNEL_PID="$!"

for i in {1..30}; do
  if grep -q "Waiting for connections" "$LOG_PATH" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$TUNNEL_PID" >/dev/null 2>&1; then
    echo "ERROR: SSM tunnel exited unexpectedly. Log at ${LOG_PATH}" >&2
    dump_log
    exit 1
  fi
  sleep 1
done

if ! grep -q "Waiting for connections" "$LOG_PATH" 2>/dev/null; then
  echo "ERROR: SSM tunnel did not become ready. Log at ${LOG_PATH}" >&2
  dump_log
  exit 1
fi

echo "Tunnel ready. Running migrations and demo seed..."

cd "$ROOT_DIR/services/api"

db_env=(DB_SSL=true DB_SSL_CA_PATH=)
if [[ -n "$DATABASE_URL_FOR_TUNNEL" ]]; then
  db_env+=(DATABASE_URL="$DATABASE_URL_FOR_TUNNEL")
else
  db_env+=(DB_HOST=localhost DB_PORT="$LOCAL_PORT")
fi

if [[ -z "$SKIP_DB_MIGRATIONS" ]]; then
  env "${db_env[@]}" pnpm exec tsx scripts/migrate.ts
fi

env \
  DEMO_MODE=true \
  DEMO_INCREMENTAL="$DEMO_INCREMENTAL" \
  DEMO_RESET_ON_STARTUP="$DEMO_RESET_ON_STARTUP" \
  DEMO_FORCE_RESEED="$DEMO_FORCE_RESEED" \
  DEMO_SHIFT_REGENERATE_PDFS="$DEMO_SHIFT_REGENERATE_PDFS" \
  "${db_env[@]}" \
  pnpm exec tsx src/db/seed-demo.ts

echo "✓ Demo seed completed via SSM tunnel"
