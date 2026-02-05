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

get_secret_payload() {
  local secret_id="$1"
  local errfile
  errfile="$(mktemp)"
  local output=""

  if ! output="$(
    AWS_PAGER="" aws secretsmanager get-secret-value \
      --secret-id "$secret_id" \
      --no-cli-pager \
      --output json 2>"$errfile"
  )"; then
    echo "ERROR: failed to read secret '${secret_id}'" >&2
    cat "$errfile" >&2 || true
    rm -f "$errfile"
    exit 1
  fi

  rm -f "$errfile"

  if [[ -z "$output" ]]; then
    echo "ERROR: Secrets Manager returned an empty payload for '${secret_id}'." >&2
    exit 1
  fi

  printf '%s' "$output"
}

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
LOCAL_PORT="${LOCAL_PORT:-55433}"

DEMO_INCREMENTAL="${DEMO_INCREMENTAL:-true}"
DEMO_RESET_ON_STARTUP="${DEMO_RESET_ON_STARTUP:-true}"
DEMO_FORCE_RESEED="${DEMO_FORCE_RESEED:-false}"
DEMO_SHIFT_REGENERATE_PDFS="${DEMO_SHIFT_REGENERATE_PDFS:-true}"
RESET_DEMO_DB="${RESET_DEMO_DB:-false}"

STOP_INSTANCE_ON_EXIT="${STOP_INSTANCE_ON_EXIT:-true}"
SKIP_DB_MIGRATIONS="${SKIP_DB_MIGRATIONS:-}"
DB_WAIT_TIMEOUT_SECONDS="${DB_WAIT_TIMEOUT_SECONDS:-900}"
DB_WAIT_RETRY_DELAY_MS="${DB_WAIT_RETRY_DELAY_MS:-1000}"

DATABASE_URL_FOR_TUNNEL=""
if [[ -n "${DATABASE_URL_SECRET_ARN:-}" ]]; then
  SECRET_VALUE="$(get_secret_payload "$DATABASE_URL_SECRET_ARN")"

  DATABASE_URL_FOR_TUNNEL="$(
    SECRET_PAYLOAD="$SECRET_VALUE" python3 - "$LOCAL_PORT" <<'PY'
import base64
import json
import os
import sys
import urllib.parse

payload = json.loads(os.environ.get("SECRET_PAYLOAD", ""))
local_port = sys.argv[1]

def build_url(user: str, password: str, dbname: str) -> str:
    user_enc = urllib.parse.quote(user or "")
    pass_enc = urllib.parse.quote(password or "")
    auth = ""
    if user_enc or pass_enc:
        auth = f"{user_enc}:{pass_enc}@"
    return f"postgresql://{auth}localhost:{local_port}/{dbname}"

raw = payload.get("SecretString")
if not raw and payload.get("SecretBinary"):
    raw = base64.b64decode(payload["SecretBinary"]).decode("utf-8")
raw = (raw or "").strip()

def use_connection_string(conn: str) -> str:
    url = urllib.parse.urlparse(conn)
    user = urllib.parse.unquote(url.username or "")
    password = urllib.parse.unquote(url.password or "")
    dbname = (url.path or "").lstrip("/") or os.environ.get("DB_NAME", "club_operations")
    return build_url(user, password, dbname)

def use_password_only(password: str) -> str:
    user = os.environ.get("DB_USER", "clubops")
    dbname = os.environ.get("DB_NAME", "club_operations")
    return build_url(user, password, dbname)

if not raw:
    sys.stderr.write("ERROR: SecretString/SecretBinary is empty.\n")
    sys.exit(1)

if raw.startswith("postgres://") or raw.startswith("postgresql://"):
    print(use_connection_string(raw))
    sys.exit(0)

data = None
if raw.startswith("{"):
    try:
        data = json.loads(raw)
    except Exception:
        data = None

if isinstance(data, dict):
    url_value = (
        data.get("DATABASE_URL")
        or data.get("database_url")
        or data.get("url")
    )
    if isinstance(url_value, str) and url_value.startswith(("postgres://", "postgresql://")):
        print(use_connection_string(url_value))
        sys.exit(0)

    user = data.get("username") or data.get("user") or os.environ.get("DB_USER", "clubops")
    password = data.get("password", "")
    dbname = data.get("dbname") or data.get("database") or os.environ.get("DB_NAME", "club_operations")

    if password:
        print(build_url(user, password, dbname))
        sys.exit(0)

# Fallback: treat raw as a password-only secret.
print(use_password_only(raw))
PY
  )"
  echo "Using DATABASE_URL from Secrets Manager (host forced to localhost:${LOCAL_PORT})."
fi

LOG_PATH="${LOG_PATH:-/tmp/ssm-tunnel.log}"
TUNNEL_PID=""
TUNNEL_READY_TIMEOUT_SECONDS="${TUNNEL_READY_TIMEOUT_SECONDS:-60}"
KILL_PORT_LISTENER="${KILL_PORT_LISTENER:-true}"

if [[ "${SKIP_PNPM_INSTALL:-}" != "true" ]]; then
  echo "Installing dependencies..."
  (cd "$ROOT_DIR" && pnpm install --frozen-lockfile)
fi

if [[ "${SKIP_SHARED_BUILD:-}" != "true" ]]; then
  echo "Building shared package..."
  (cd "$ROOT_DIR" && pnpm turbo run build --filter=@club-ops/shared)
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

is_port_listening() {
  local port="$1"
  python3 - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket()
sock.settimeout(0.5)
try:
    sock.connect(("127.0.0.1", port))
    sys.exit(0)
except Exception:
    sys.exit(1)
finally:
    sock.close()
PY
}

kill_port_listener() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    echo "ERROR: port ${port} is in use and 'lsof' is unavailable to identify the listener." >&2
    echo "Set LOCAL_PORT to a free port or install lsof." >&2
    exit 1
  fi

  local pids=""
  pids="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    echo "ERROR: port ${port} is in use but no listener PID was found." >&2
    echo "Set LOCAL_PORT to a free port and retry." >&2
    exit 1
  fi

  echo "Port ${port} is in use. Terminating listener(s): ${pids}"
  kill ${pids} >/dev/null 2>&1 || true
  sleep 1

  if is_port_listening "$port"; then
    echo "ERROR: port ${port} is still in use after termination attempt." >&2
    echo "Set LOCAL_PORT to a free port and retry." >&2
    exit 1
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

if is_port_listening "$LOCAL_PORT"; then
  if [[ "$KILL_PORT_LISTENER" == "true" ]]; then
    kill_port_listener "$LOCAL_PORT"
  else
    echo "ERROR: local port ${LOCAL_PORT} is already in use. Set LOCAL_PORT to a free port." >&2
    exit 1
  fi
fi

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

ready=false
for ((i=1; i<=TUNNEL_READY_TIMEOUT_SECONDS; i++)); do
  if grep -Eq "Waiting for connections|Port [0-9]+ opened" "$LOG_PATH" 2>/dev/null; then
    ready=true
    break
  fi
  if is_port_listening "$LOCAL_PORT"; then
    ready=true
    break
  fi
  if ! kill -0 "$TUNNEL_PID" >/dev/null 2>&1; then
    echo "ERROR: SSM tunnel exited unexpectedly. Log at ${LOG_PATH}" >&2
    dump_log
    exit 1
  fi
  sleep 1
done

if [[ "$ready" != "true" ]]; then
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
db_env+=(DB_WAIT_TIMEOUT_SECONDS="$DB_WAIT_TIMEOUT_SECONDS" DB_WAIT_RETRY_DELAY_MS="$DB_WAIT_RETRY_DELAY_MS")

echo "Waiting for database readiness..."
env "${db_env[@]}" pnpm exec tsx scripts/wait-for-db.ts

if [[ -z "$SKIP_DB_MIGRATIONS" ]]; then
  env "${db_env[@]}" pnpm exec tsx scripts/migrate.ts
fi

if [[ "$RESET_DEMO_DB" == "true" ]]; then
  echo "RESET_DEMO_DB=true: forcing full demo reseed (DEMO_FORCE_RESEED=true, DEMO_INCREMENTAL=false)."
  DEMO_FORCE_RESEED="true"
  DEMO_INCREMENTAL="false"
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
