# デプロイ手順書

## 1. Docker Compose (推奨 / 単一ホスト)

### 前提
- Docker Engine 24+ / Docker Compose v2+
- 開放ポート: 3000 (app), 5432 (db), 6379 (redis) ※外部公開は app のみ推奨

### 手順

```bash
git clone <repo> taskbar-hero-market && cd taskbar-hero-market
cp .env.example .env
```

`.env` を本番向けに編集:

```env
POSTGRES_PASSWORD=<強固なパスワード>
ADMIN_TOKEN=<ランダムな長い文字列>
SEED_ON_START=false           # 本番はシードを無効化
STEAM_CURRENCY=23             # JPY
DISCORD_WEBHOOK_URL=<任意>
```

ビルド & 起動:

```bash
docker compose up -d --build
docker compose logs -f app    # 起動ログ (マイグレーション適用を確認)
```

- `app` コンテナの `entrypoint.sh` が起動時に `prisma migrate deploy` を実行する。
- `SEED_ON_START=false` の場合、初回はデータが空なので
  管理画面の「データ更新」または `docker compose exec app npm run fetch:market` で投入する。

### 動作確認

```bash
curl -s http://localhost:3000/api/admin/status | jq
```

### アップデート

```bash
git pull
docker compose up -d --build       # 新マイグレーションは起動時に自動適用
```

### バックアップ

```bash
docker compose exec db pg_dump -U taskbar taskbar_hero > backup_$(date +%F).sql
# リストア
cat backup.sql | docker compose exec -T db psql -U taskbar taskbar_hero
```

---

## 2. リバースプロキシ (HTTPS 公開)

Nginx 例:

```nginx
server {
  server_name market.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  # SSE (リアルタイム配信 /api/live) はバッファリングを無効化すること
  location /api/live {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
  }
}
```

> SSEは `proxy_buffering off` が必須（アプリ側で `X-Accel-Buffering: no` も送出済み）。
> Xserver VPS の目安: **1日ピーク総数1万人（同時100〜300）なら 8GB/6コア 1台で十分**。同時数千を超えたら DB を別VPSへ分離し、アプリを複数台＋ロードバランサ、Redis pub/sub でSSEをファンアウト。

`certbot --nginx -d market.example.com` で証明書を発行。
`docker-compose.yml` の `app` の `ports` を `127.0.0.1:3000:3000` に絞り、外部公開はNginx経由のみにする。

---

## 3. マネージド構成 (スケールさせる場合)

| コンポーネント | 置き換え先 |
|---|---|
| PostgreSQL | RDS / Cloud SQL / Supabase / Neon |
| Redis | ElastiCache / Upstash |
| app | Vercel / Cloud Run / ECS (Dockerfile をそのまま利用) |
| worker | 常駐コンテナ or スケジューラ (Cloud Scheduler + Cloud Run Job 等) |

注意点:
- `app` は `next.config.ts` の `output: "standalone"` でビルドされる。
- worker は app とは別プロセス。マネージドでは「15分毎に `npm run analyze` + 取得」を
  スケジューラから叩く構成に置き換え可能。
- Vercel 等のサーバレスに載せる場合、`worker` は Cron Job (Vercel Cron → `/api/admin/refresh`) で代替する。

```
# Vercel Cron 例 (vercel.json)
{ "crons": [{ "path": "/api/admin/refresh", "schedule": "*/15 * * * *" }] }
```
(その場合 `/api/admin/refresh` のトークン検証をCron用に調整すること)

---

## 4. 環境変数チェックリスト (本番)

- [ ] `DATABASE_URL` — 本番DBを指す
- [ ] `REDIS_URL` — 本番Redis
- [ ] `POSTGRES_PASSWORD` — 既定値から変更済み
- [ ] `ADMIN_TOKEN` — 推測困難な値
- [ ] `SEED_ON_START=false`
- [ ] `STEAM_REQUEST_INTERVAL_MS` — レート制限に配慮 (3500ms 以上推奨)
- [ ] `DISCORD_WEBHOOK_URL` / SMTP — 通知を使う場合

---

## 5. トラブルシューティング

| 症状 | 対処 |
|---|---|
| app が DB に接続できない | `db` のヘルスチェック通過を待つ。`entrypoint.sh` がリトライする |
| Steam取得が0件 | 対象appにマーケットが無い/レート制限。ログの message を確認 |
| 価格履歴が増えない | `pricehistory` はログイン必須。`STEAM_LOGIN_COOKIE` 設定 or スナップショット蓄積を待つ |
| キャッシュが古い | 管理画面「キャッシュ削除」or `DELETE /api/admin/cache` |
