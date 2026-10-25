#!/usr/bin/env bash
# Runs the end-to-end checks against a fresh, isolated database.
# Recreates $E2E_DB (default car_dealer_e2e; the name must end in _e2e),
# seeds a test admin, builds the frontend, starts the API and a static
# server on their own ports, runs e2e.mjs and stops both servers.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"

E2E_DB="${E2E_DB:-car_dealer_e2e}"
case "$E2E_DB" in
  *_e2e) ;;
  *) echo "Refusing to recreate '$E2E_DB': the E2E database name must end in _e2e" >&2; exit 1 ;;
esac
export E2E_API_PORT="${E2E_API_PORT:-3100}"
export E2E_FRONTEND_PORT="${E2E_FRONTEND_PORT:-5180}"
export E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@e2e.test}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-e2e-admin-pass}"
export E2E_BASE_URL="http://localhost:$E2E_FRONTEND_PORT"
export E2E_API_URL="http://localhost:$E2E_API_PORT/api"
DATABASE_URL="${E2E_DATABASE_URL:-postgres://localhost:5432/$E2E_DB}"

dropdb --if-exists "$E2E_DB"
createdb "$E2E_DB"
(cd "$ROOT/backend" && DATABASE_URL="$DATABASE_URL" ADMIN_EMAIL="$E2E_ADMIN_EMAIL" ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" npx tsx src/db/seedAdmin.ts)
(cd "$ROOT/frontend" && npm run build >/dev/null)

(cd "$ROOT/backend" && PORT="$E2E_API_PORT" DATABASE_URL="$DATABASE_URL" JWT_SECRET="e2e-only-$(openssl rand -hex 16)" JWT_EXPIRES_IN=1h exec node --import tsx src/server.ts) &
API_PID=$!
node serve.mjs &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$E2E_API_URL/vehicles")" = 401 ] &&
     [ "$(curl -s -o /dev/null -w '%{http_code}' "$E2E_BASE_URL/")" = 200 ]; then
    break
  fi
  sleep 0.5
done

node e2e.mjs
