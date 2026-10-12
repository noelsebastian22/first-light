#!/usr/bin/env bash
# Applies the migrations to a fresh database and runs the RLS assertions.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres db/test/run.sh
#
# DATABASE_URL must be a superuser on a throwaway Postgres 18 (CI's service
# container, or a local one): the script drops and recreates first_light_test.
# PSQL overrides the client, e.g. PSQL="docker exec -i pg psql" when psql isn't installed.
set -euo pipefail
shopt -s nullglob

: "${DATABASE_URL:?set DATABASE_URL to a throwaway Postgres 18 superuser connection}"
PSQL=${PSQL:-psql}
cd "$(dirname "$0")/.."

{
  # printf, not echo: some shells read the \c in \connect as "stop output".
  printf '%s\n' 'drop database if exists first_light_test with (force);' 'create database first_light_test;' '\connect first_light_test'
  cat test/shim.sql
  for migration in migrations/*.sql; do cat "$migration"; done
  cat test/rls.sql
} | $PSQL "$DATABASE_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1

echo "ok: rls tests passed"
