#!/usr/bin/env bash
# Rebuilds the LOCAL test database: production schema baseline + the new
# content-engine migrations (+ their verify scripts). Never touches production.
#
# Usage: ./scripts/content-engine/reset-test-db.sh
#
# Prerequisites:
#   - Docker running (supabase start already executed)
#   - supabase/test/prod-baseline.sql present (run: supabase db dump --linked -f supabase/test/prod-baseline.sql)
#   - psql available (brew install libpq && brew link --force libpq)
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_URL="${SUPABASE_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ ! -f supabase/test/prod-baseline.sql ]]; then
  echo "Missing supabase/test/prod-baseline.sql — run:" >&2
  echo "  supabase db dump --linked -f supabase/test/prod-baseline.sql" >&2
  exit 1
fi

# Resolve psql: prefer system install, fall back to the supabase docker container.
if command -v psql &>/dev/null; then
  PSQL="psql"
elif command -v /usr/local/opt/libpq/bin/psql &>/dev/null; then
  PSQL="/usr/local/opt/libpq/bin/psql"
else
  # Use psql from inside the supabase db container
  DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase_db|supabase-db' | head -1)
  if [[ -z "$DB_CONTAINER" ]]; then
    echo "psql not found and no supabase DB container running. Install psql:" >&2
    echo "  brew install libpq && brew link --force libpq" >&2
    exit 1
  fi
  PSQL="docker exec -i $DB_CONTAINER psql -U postgres"
fi

echo "Resetting local test DB schema..."

# Drop and recreate the public schema (avoids replaying historical migrations
# that ALTER pre-existing tables and would fail against an empty DB).
# Storage schema lives in a separate schema and survives this reset.
$PSQL "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
SQL

echo "Applying production schema baseline..."
$PSQL "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/test/prod-baseline.sql

# Apply only content-engine migrations (20260611* prefix), skipping rollbacks.
shopt -s nullglob
for f in supabase/migrations/20260611*.sql; do
  case "$f" in
    *_rollback.sql|*_verify.sql) continue ;;
  esac
  echo "applying $f"
  $PSQL "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

# Run verify scripts for content-engine migrations.
for f in supabase/migrations/20260611*_verify.sql; do
  [[ -e "$f" ]] || continue
  echo "verifying $f"
  $PSQL "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "test db ready"
