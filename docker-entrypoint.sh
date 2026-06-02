#!/bin/sh
set -e

echo "[entrypoint] Waiting for database to be ready..."
# Give MySQL a moment after healthcheck passes before pushing schema
sleep 2

echo "[entrypoint] Applying database schema..."
pnpm db:push

echo "[entrypoint] Starting server..."
exec node dist/index.js
