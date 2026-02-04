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

LOG_PATH="${LOG_PATH:-/tmp/ssm-tunnel.log}"
TUNNEL_PID=""

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
  if rg -q "Waiting for connections" "$LOG_PATH" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$TUNNEL_PID" >/dev/null 2>&1; then
    echo "ERROR: SSM tunnel exited unexpectedly. Log at ${LOG_PATH}" >&2
    exit 1
  fi
  sleep 1
done

if ! rg -q "Waiting for connections" "$LOG_PATH" 2>/dev/null; then
  echo "ERROR: SSM tunnel did not become ready. Log at ${LOG_PATH}" >&2
  exit 1
fi

echo "Tunnel ready. Running migrations and demo seed..."

cd "$ROOT_DIR/services/api"

if [[ -z "$SKIP_DB_MIGRATIONS" ]]; then
  DB_HOST=localhost \
  DB_PORT="$LOCAL_PORT" \
  DB_SSL=true \
  DB_SSL_CA_PATH= \
    pnpm exec tsx scripts/migrate.ts
fi

DEMO_MODE=true \
DEMO_INCREMENTAL="$DEMO_INCREMENTAL" \
DEMO_RESET_ON_STARTUP="$DEMO_RESET_ON_STARTUP" \
DEMO_FORCE_RESEED="$DEMO_FORCE_RESEED" \
DEMO_SHIFT_REGENERATE_PDFS="$DEMO_SHIFT_REGENERATE_PDFS" \
DB_HOST=localhost \
DB_PORT="$LOCAL_PORT" \
DB_SSL=true \
DB_SSL_CA_PATH= \
  pnpm exec tsx src/db/seed-demo.ts

echo "✓ Demo seed completed via SSM tunnel"
