#!/bin/sh
set -e

echo "[entrypoint] Waiting for database..."
# DATABASE_URL から host:port を抽出して待機
until npx prisma migrate deploy 2>/dev/null; do
  echo "[entrypoint] DB not ready / migration pending, retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Migrations applied."

# 初回のみシード投入 (Items が空のときだけ)
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] Seeding (idempotent)..."
  node_modules/.bin/tsx prisma/seed.ts || echo "[entrypoint] seed skipped/failed (continuing)"
fi

echo "[entrypoint] Starting app: $@"
exec "$@"
