# 本番公開前 監査レポート（セキュリティ / SRE）

対象: Taskbar Hero Steam Market Analytics
監査日: 2026-06-13

> **前提（重要）**: 本プロジェクトの実スタックは **Next.js 15 + 自前 PostgreSQL(Prisma) + Redis + Docker（Xserver VPS想定）**。
> 指示書にある **Supabase / Vercel** は採用していないため、該当項目は実スタックへ読み替えて監査した（§2, §8, §9 に対照表）。

凡例: 重大度 🔴Critical / 🟠High / 🟡Medium / 🟢Low ／ 状態 ✅実装済 / 📝要対応(手順記載) / ➖非該当

---

## 1. 問題一覧・重大度・対応

| # | 領域 | 問題 | 重大度 | 対応 | 実装箇所 |
|---|---|---|---|---|---|
| 1 | API | レートリミット無し（特に注文板=Steam代理・SSE） | 🔴 | ✅ | `src/middleware.ts`（IP別・ルート種別で上限可変・429） |
| 2 | Header | セキュリティヘッダ/CSP無し | 🔴 | ✅ | `next.config.ts`（CSP/HSTS/XFO/nosniff/Referrer/Permissions、`X-Powered-By`削除） |
| 3 | 認可 | 管理APIがトークン未設定時に素通り | 🔴 | ✅ | `src/lib/admin-auth.ts`（本番fail-closed・`timingSafeEqual`）を refresh/cache/status に適用 |
| 4 | 入力 | 一覧APIのenum/数値が未検証（不正値でPrismaエラー） | 🟠 | ✅ | `queries.ts`（許可リスト+範囲clamp+q長さ制限） |
| 5 | 堅牢性 | Steam取得にバックオフ/タイムアウト無し | 🟠 | ✅ | `src/lib/steam/http.ts`（指数バックオフ+ジッタ+12sタイムアウト）を fetch/orderbook/news に適用 |
| 6 | 障害 | Error Boundary / 500ページ無し | 🟠 | ✅ | `src/app/error.tsx`, `src/app/global-error.tsx`（404は既存 `not-found.tsx`） |
| 7 | SEO | sitemap.xml / robots.txt 無し | 🟠 | ✅ | `src/app/sitemap.ts`, `src/app/robots.ts`、アイテム詳細に動的metadata+canonical |
| 8 | API | SSE接続が無制限（DoS面） | 🟡 | ✅ | middleware で `/api/live` を20req/min/IP に制限（接続スパム抑制） |
| 9 | 監視 | エラー収集を実装済み（`monitoring.ts`・env未設定はログのみ／DSN・Webhookで送信） | 🟢 | ✅ | §6。クライアント境界→`/api/client-error`、jobs/worker捕捉 |
| 10 | DB | マイグレーションのE2E未検証 | 🟠 | 📝 | Dockerが当環境で不安定→VPS初回起動でログ確認（§8） |
| 11 | 秘密 | フロント漏洩 | 🟢 | ✅ | `NEXT_PUBLIC_*` は site_url/appid/currency/adsense のみ（秘密なし）。`.env` は `.gitignore` 済 |
| 12 | i18n | alert-form / グラフ期間タブが一部JP | 🟢 | 📝 | 残い（任意） |

---

## 2. DB / 権限監査（Supabase項目の読み替え）

| Supabase概念 | 本スタックでの対応 | 状態 |
|---|---|---|
| RLS (Row Level Security) | アプリ層で認可（`getCurrentUserId`/`isAdmin`）。DBは**アプリ専用ロール1つ**で接続し外部公開しない | 📝 下記 |
| anon / authenticated / service_role | 不要（PostgREST非使用）。DBポートは**公開しない** | ✅ compose内ネットワークのみ |
| インデックス | 主要カラムに付与済（`@@index`：type/part/grade/classType/level/active、latest(lowestPrice/quantity/change7d)、価格履歴(itemId,timestamp) 他） | ✅ schema.prisma |
| 不要データ | `MarketSnapshot`/`PriceHistory` は時系列で増える→**保持期間ジョブ**を推奨（90日超を削除） | 📝 |

**DBハードニング手順（本番）**
1. PostgreSQL を**外部公開しない**（compose の `db` は `ports` を外し、`app`/`worker` からのみ接続）。今は開発用に5432公開→本番は削除。
2. アプリ用ロールを最小権限に（`CONNECT`,`SELECT/INSERT/UPDATE/DELETE` のみ。`SUPERUSER`不可）。
3. 強固な `POSTGRES_PASSWORD`。
4. 定期 `pg_dump` バックアップ（§8）。
5. 保持期間ジョブ例: `DELETE FROM "PriceHistory" WHERE timestamp < now() - interval '120 days';`

---

## 3. バックエンド堅牢性

- **Steam障害/タイムアウト/レスポンス変更耐性**: `steamFetch` が指数バックオフ+ジッタ+`AbortController`タイムアウトで再試行。最終失敗時も**ジョブは落とさず**既存データで分析継続（`jobs.ts` try/catch、`fetchLog` に記録）。注文板/ニュースは失敗時 空/0件 を返してUIを壊さない。
- **リトライ**: 429は基準×4の長めバックオフ、5xx/ネットワークは指数。
- **ログ**: `FetchLog`（kind/status/件数/message/時刻）。注文板失敗は対象hash付きで `console.warn`。→ 本番は Sentry/構造化ログへ送る（§6）。
- **レート制限遵守**: `STEAM_REQUEST_INTERVAL_MS` で逐次。ホット銘柄のみ20秒間隔・件数上限。

---

## 4. パフォーマンス

- **Server Components 主体**: ダッシュボード/一覧ページ/詳細/ランキング/異常/News は Server Component。Client は必要箇所のみ（チャート, 注文板, フィルタ, ライブ受信, 言語/モード, 管理）。
- **キャッシュ**: Redis で dashboard/ranking/items/history/news/orderbook をTTLキャッシュ。`invalidate` で更新時失効。
- **N+1**: 一覧/ランキングは `include` で1クエリ取得。非正規化テーブル（`ItemLatest`/`ItemAnalysis`/`FavoriteStat`）で集計回避。
- **目標 Lighthouse 90+**: 画像は `next/image` 相当のCDN、JSはコード分割済。**未計測**（要本番計測）。改善余地: 一覧の `force-dynamic` を short‑revalidate ISR 化、フォント最適化、AdSenseの遅延読込。

---

## 5. 障害対策（実装済）
- `error.tsx`（ルート単位 Error Boundary・再試行）, `global-error.tsx`（レイアウト崩壊時）, `not-found.tsx`（404）。
- API は失敗時に `{ error }` + 適切なHTTPステータス。注文板/ニュースは**空フォールバック**でUIを保つ。

---

## 6. 運用監視（実装済み）
- **エラー収集は実装済み** (`src/lib/monitoring.ts`・依存パッケージ無し)。`captureException()` が ① 常に構造化JSONログ ② `SENTRY_DSN` 設定時は Sentry へ最小エンベロープ送信 ③ `MONITORING_WEBHOOK_URL` 設定時は Discord/Slack/汎用へ JSON POST。**env未設定ならログのみ**で本番でも安全。
  - 配線: クライアント境界 (`error.tsx`/`global-error.tsx`) → `POST /api/client-error` → サーバで送信（DSN/Webhookを秘匿）。サーバは `jobs.ts`(runRefresh/news) と `worker` の例外を捕捉。
  - 確認: worker起動ログ `monitoring = log-only|enabled(...)` ／ `GET /api/admin/status` の `monitoring` フィールド。
  - （任意で `@sentry/nextjs` フルSDKに差し替える場合は `captureException` の中身のみ置換すれば配線は不変。）
- **計測対象**: API 5xx率 / 429率 / DBエラー / Steam取得失敗（`FetchLog.status=FAILED`）/ ページ表示速度（Web Vitals）。
- **アクセス解析**: 自前なら Umami/Plausible（軽量・プライバシー配慮）。Vercel採用時のみ Vercel Analytics。
- **ヘルスチェック**: `GET /api/admin/status`（要トークン）で件数/最終更新を監視。Uptime監視は `/`（200確認）。

---

## 7. SEO（実装済 + 残）
- ✅ `robots.txt`（/admin・/api・/favorites を除外、sitemap参照）
- ✅ `sitemap.xml`（主要ページ + 上位アイテム最大2000、DB未接続でも静的分は返す）
- ✅ メタデータ: ルート `metadataBase`/title template/OG/robots、**アイテム詳細に動的title+canonical+OG画像**
- 📝 残: 一覧/ランキング等への canonical 個別付与（パラメータ重複対策）。多言語の `hreflang`（cookieロケールのため現状は単一URL—URLロケール化する場合に対応）

---

## 8. 本番公開準備（VPS基準 / Vercel対照）

### 8-1. 必要設定（Xserver VPS = 推奨構成）
1. VPS(Ubuntu) に Docker / Docker Compose。
2. リポジトリ配置、`.env` 設定（§8-2）。
3. `docker compose up -d --build`（初回: マイグレ→seed 自動。**ログ確認**: `docker compose logs -f app`）。
4. Nginx + certbot で HTTPS。`/api/live` は `proxy_buffering off`（`docs/DEPLOY.md`）。
5. `db` の `ports:5432` を本番で削除（外部非公開）。`SEED_ON_START=false`。

### 8-2. 環境変数一覧
| 変数 | 公開 | 用途 |
|---|---|---|
| `DATABASE_URL` | サーバ | Postgres接続 |
| `REDIS_URL` | サーバ | Redis（無いとキャッシュ/SSE/レート制限の一部が縮退） |
| `STEAM_APP_ID=3678970` / `STEAM_CURRENCY=8` | 一部public | 取得設定 |
| `ADMIN_TOKEN` | サーバ | 管理API（**本番必須・推測困難**） |
| `SEED_ON_START=false` | サーバ | 本番はseed無効 |
| `NEXT_PUBLIC_SITE_URL` | public | 正規URL（SEO/sitemap/OG） |
| `NEXT_PUBLIC_ADSENSE_CLIENT` / `NEXT_PUBLIC_AD_SLOT_*` | public | 広告 |
| `SENTRY_DSN`（任意） | サーバ | 監視 |
| `DISCORD_WEBHOOK_URL`（任意） | サーバ | 通知 |

### 8-3. DNS
- A/AAAA レコードを VPS のIPへ。`www` は CNAME→apex。Nginxで `www`→apex（または逆）に301。

### 8-4. デプロイ手順
```bash
git pull
docker compose up -d --build      # 新マイグレーションは entrypoint が自動適用
docker compose logs -f app
```

### 8-5. ロールバック手順
```bash
# 直前のイメージ/コミットへ
git checkout <previous-tag>
docker compose up -d --build
# DBマイグレーションを伴う場合は事前バックアップから復元
cat backup_YYYY-MM-DD.sql | docker compose exec -T db psql -U taskbar taskbar_hero
```
- **原則**: マイグレーションは後方互換（列追加優先・破壊的変更は2段階）。デプロイ前に必ず `pg_dump`。

### 8-6. Vercel + Supabase へ寄せる場合（無料枠狙い）
- **要改修**: 常駐 `worker`（15分+20秒ループ）→ **Vercel Cron** が `/api/admin/refresh` を叩く方式へ（20秒のホット更新は不可→注文板はオンデマンド取得+キャッシュに縮退）。`Redis(ioredis)` → **Upstash Redis(REST)**。SSE は Vercel(Node) で可だが**接続時間/同時数に制限**→ポーリング併用推奨。Postgres → **Supabase**（RLSはアプリ層認可のままでも可、ただし匿名公開しない）。
- **トレードオフ**: 「リアルタイム命」の要件は **VPSの方が素直**。Vercel無料枠は実行時間/帯域上限があり、SSE常時接続+高頻度更新と相性が悪い。

---

## 9. コスト / スケール分析

サーバ実費の主因は **PV数より「同時接続(SSE)」と「Steam取得頻度」**。

| 月間PV | 同時接続(概算) | VPS推奨 | Vercel/Supabase無料枠 |
|---|---|---|---|
| 1万 | 数〜十数 | 2–4GB で可 | 概ね収まる（Cron/帯域とも余裕） |
| 10万 | 数十 | **4–8GB**（推奨8GB） | Supabase無料(500MB/帯域)・Vercel無料の関数実行/帯域が**逼迫し始める** |
| 100万 | 数百 | 8–16GB（DB分離検討） | **無料枠超過濃厚**（Supabase Pro $25〜, Vercel Pro $20〜, Upstash従量）。SSE同時数で関数が頭打ち |

**ボトルネック順**: ①SSE同時接続（メモリ/FD）②Steamレート制限（鮮度の上限）③Postgres書き込み（時系列）④帯域。
**対策**: ②③は worker 集約+キャッシュで吸収済。①は単一VPSで数千接続まで現実的、それ以上は水平分割+Redis pub/sub（実装済の配信基盤がそのまま活きる）。

> **結論**: 「リアルタイム命 + 月数万〜十万PV」なら **Xserver VPS 8GB 1台が最もコスパ良**。完全無料運用は要件（リアルタイム）と両立しにくい。

---

## 10. 本番公開チェックリスト

**セキュリティ**
- [ ] `ADMIN_TOKEN` を推測困難な値に設定（本番で未設定だと管理APIは拒否される）
- [ ] `POSTGRES_PASSWORD` を強固に
- [ ] `db` の `5432` 公開を削除（compose）
- [ ] HTTPS（certbot）+ HSTS 有効
- [ ] CSP が広告/Steam画像で破綻しないか実機確認（必要ならドメイン追記）

**機能/データ**
- [ ] `SEED_ON_START=false`、初回のみ手動 seed か実取得
- [ ] `STEAM_CURRENCY=8`（JPY）/ `STEAM_APP_ID=3678970`
- [ ] `docker compose logs` でマイグレ適用・worker稼働を確認
- [ ] `/api/live` のSSEが流れる（topbar ● LIVE 点灯）

**SEO/運用**
- [ ] `NEXT_PUBLIC_SITE_URL` を本番URLに
- [ ] `robots.txt` / `sitemap.xml` が200で返る
- [ ] （任意）`SENTRY_DSN` か `MONITORING_WEBHOOK_URL` を設定して送信先を有効化（未設定でもログ収集は動作）
- [ ] `pg_dump` バックアップのcron設定
- [ ] Uptime監視（`/` 200）

**計測**
- [ ] Lighthouse Performance 90+ を本番で計測・改善

---

## 付録: 今回の実装差分（ファイル）
- `next.config.ts`（ヘッダ/CSP）
- `src/middleware.ts`（レート制限）
- `src/lib/admin-auth.ts` + admin各route（認可）
- `src/lib/steam/http.ts` + fetch/orderbook/news（バックオフ）
- `src/lib/queries.ts`（入力検証）
- `src/app/error.tsx` / `global-error.tsx`（障害）
- `src/app/sitemap.ts` / `robots.ts` / 詳細metadata（SEO）
