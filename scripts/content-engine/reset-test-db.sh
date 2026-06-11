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

# Guard: refuse to run against any non-local database.
case "$DB_URL" in
  *@127.0.0.1:*|*@localhost:*) ;;  # local only
  *) echo "Refusing to run against non-local database: $DB_URL" >&2; exit 1 ;;
esac

if [[ ! -f supabase/test/prod-baseline.sql ]]; then
  echo "Missing supabase/test/prod-baseline.sql — run:" >&2
  echo "  supabase db dump --linked -f supabase/test/prod-baseline.sql" >&2
  exit 1
fi

# Resolve psql: prefer system install, then Homebrew libpq (arm64 then Intel),
# then fall back to the supabase docker container.
DB_CONTAINER=""
if command -v psql &>/dev/null; then
  PSQL_BIN="psql"
elif [[ -x /opt/homebrew/opt/libpq/bin/psql ]]; then
  PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
elif [[ -x /usr/local/opt/libpq/bin/psql ]]; then
  PSQL_BIN="/usr/local/opt/libpq/bin/psql"
else
  # Guard against docker not being installed before calling docker ps.
  if ! command -v docker >/dev/null; then
    echo "psql not found and docker is not installed. Install psql:" >&2
    echo "  brew install libpq && brew link --force libpq" >&2
    exit 1
  fi
  DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase_db|supabase-db' | head -1)
  if [[ -z "$DB_CONTAINER" ]]; then
    echo "psql not found and no supabase DB container running. Install psql:" >&2
    echo "  brew install libpq && brew link --force libpq" >&2
    exit 1
  fi
  PSQL_BIN=""
fi

# run_psql: unified wrapper so all callers work identically regardless of
# whether we use a host psql or docker exec.
#
# Usage:
#   run_psql [extra psql flags] <<'SQL'  — for heredoc input
#   run_psql -f <file>                   — for file input
run_psql() {
  if [[ -n "$PSQL_BIN" ]]; then
    "$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=1 -q "$@"
  else
    # Inside the container postgres listens on its default port (5432) via
    # unix socket — do NOT pass the external $DB_URL which uses 54322.
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"
  fi
}

echo "Resetting local test DB schema..."

# Drop and recreate the public schema (avoids replaying historical migrations
# that ALTER pre-existing tables and would fail against an empty DB).
# Storage schema lives in a separate schema and survives this reset.
run_psql <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
SQL

echo "Applying production schema baseline..."
run_psql -f supabase/test/prod-baseline.sql

# Apply only content-engine migrations (20260611* prefix), skipping rollbacks.
shopt -s nullglob
COUNT=0
for f in supabase/migrations/20260611*.sql; do
  case "$f" in
    *_rollback.sql|*_verify.sql) continue ;;
  esac
  echo "applying $f"
  run_psql -f "$f"
  (( COUNT++ )) || true
done

if [[ $COUNT -eq 0 ]]; then
  echo "WARNING: no 20260611* migrations found — baseline only" >&2
fi

# Run verify scripts for content-engine migrations.
for f in supabase/migrations/20260611*_verify.sql; do
  [[ -e "$f" ]] || continue
  echo "verifying $f"
  run_psql -f "$f"
done

echo "test db ready (applied $COUNT content-engine migrations)"
