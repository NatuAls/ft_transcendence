#!/usr/bin/env bash
# Generates .env with cryptographically random secrets on first run.
# Owner: Israel Torrico (WS8). Never writes a secret into a tracked file.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  echo "  .env already exists, keeping it (delete it to regenerate)"
  exit 0
fi

rand() { openssl rand -hex "${1:-32}"; }

PG_PASS="$(rand 24)"
cp "$ROOT/.env.example" "$ENV_FILE"

replace() { # key value
  local key="$1" value="$2"
  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys, re
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding='utf-8') as fh:
    text = fh.read()
text = re.sub(rf'(?m)^{re.escape(key)}=.*$', f'{key}={value}', text)
with open(path, 'w', encoding='utf-8') as fh:
    fh.write(text)
PY
}

replace POSTGRES_PASSWORD "$PG_PASS"
replace DATABASE_URL "postgresql://helpdesk:${PG_PASS}@postgres:5432/helpdesk?schema=public"
replace JWT_ACCESS_SECRET  "$(rand 48)"
replace JWT_REFRESH_SECRET "$(rand 48)"
replace PASSWORD_PEPPER    "$(rand 32)"

chmod 600 "$ENV_FILE"
echo "  .env created with generated secrets (mode 600)"
