#!/bin/sh
set -e

echo "[entrypoint] Waiting for database / applying migrations..."
# DB 起動待ち + マイグレーション適用。失敗理由(DB未起動か依存不足か)が分かるよう stderr は隠さない。
tries=0
until npx prisma migrate deploy; do
  tries=$((tries+1))
  echo "[entrypoint] migrate deploy failed (attempt ${tries}). DB not ready or error above — retrying in 3s..."
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
