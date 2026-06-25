# syntax=docker/dockerfile:1

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* はビルド時にバンドルへ埋め込まれる。compose の build.args から渡す。
# 未指定なら広告OFF (既定)。広告を出す時は .env に値を入れて `docker compose up -d --build`。
ARG NEXT_PUBLIC_ADS_ENABLED=false
ARG NEXT_PUBLIC_ADS_PLACEHOLDER=false
ARG NEXT_PUBLIC_ADSENSE_CLIENT=
ARG NEXT_PUBLIC_AD_SLOT_DEFAULT=
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_STEAM_APP_ID=3678970
ARG NEXT_PUBLIC_STEAM_CURRENCY=8
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
ARG NEXT_PUBLIC_PLAUSIBLE_SRC=
ENV NEXT_PUBLIC_ADS_ENABLED=${NEXT_PUBLIC_ADS_ENABLED} \
    NEXT_PUBLIC_ADS_PLACEHOLDER=${NEXT_PUBLIC_ADS_PLACEHOLDER} \
    NEXT_PUBLIC_ADSENSE_CLIENT=${NEXT_PUBLIC_ADSENSE_CLIENT} \
    NEXT_PUBLIC_AD_SLOT_DEFAULT=${NEXT_PUBLIC_AD_SLOT_DEFAULT} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_STEAM_APP_ID=${NEXT_PUBLIC_STEAM_APP_ID} \
    NEXT_PUBLIC_STEAM_CURRENCY=${NEXT_PUBLIC_STEAM_CURRENCY} \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=${NEXT_PUBLIC_PLAUSIBLE_DOMAIN} \
    NEXT_PUBLIC_PLAUSIBLE_SRC=${NEXT_PUBLIC_PLAUSIBLE_SRC}

RUN npx prisma generate && npm run build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# standalone 出力 + 静的ファイル
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI / tsx を runner で実行 (migrate deploy・seed・fetch)。
# prisma 6.19 の `@prisma/config` は effect / c12 等の hoist 依存を必要とし、
# node_modules のサブフォルダだけ抜き出すと `Cannot find module 'effect'` で
# migrate deploy が失敗し続ける(起動しない)。node_modules を丸ごとコピーして依存を完全に揃える。
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
# 実データシード用 (assets/market.json, tags.json)
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "server.js"]
