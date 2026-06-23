# 使い方ガイド（運用者 + 利用者）

Taskbar Hero Market Analytics の「動かし方・公開の仕方・更新の仕方・各画面の使い方」をまとめたガイド。

---

## A. まず動かす

### A-1. 一番簡単（Docker Compose だけ）
Docker / Docker Compose があれば、これだけ:

```bash
cp .env.example .env        # 必要なら編集（そのままでも動く）
docker compose up -d --build
```

起動時に自動で **マイグレーション適用 → 実データseed（assets/market.json）** が走る。
ブラウザで **http://localhost:3000** を開く。停止は `docker compose down`（データも消すなら `-v`）。

- `db`(PostgreSQL) / `redis` / `app`(Next.js) / `worker`(自動更新) の4サービスが立つ。

### A-2. ローカル開発（アプリはホストで実行）

```bash
npm install
docker compose up -d db redis      # DBとRedisだけDocker
npx prisma migrate dev             # スキーマ適用
npm run db:seed                    # 実データ投入
npm run dev                        # http://localhost:3000
```

> ※ 当環境では Docker Desktop が不安定なことがある。DB/Redis が立たない時は Docker Desktop を再起動。

---

## B. 本番公開（Xserver VPS 推奨）

1日ピーク総数1万人（同時100〜300）なら **8GB / 6コア 1台**で十分。

1. VPS（Ubuntu等）に **Docker / Docker Compose** を導入
2. リポジトリを配置し `.env` を本番値に編集（下記C-3）
3. `docker compose up -d --build`
4. **Nginx + HTTPS（certbot）** でドメインを前段に置く
   - SSE（`/api/live`）は **`proxy_buffering off`** が必須（→ `docs/DEPLOY.md` に設定例）
5. 広告を入れるなら `.env` に `NEXT_PUBLIC_ADSENSE_CLIENT` 等を設定して再ビルド

詳細は `docs/DEPLOY.md`。

---

## C. 運用（更新・管理）

### C-1. データ更新の仕組み
- **worker** が自動で回す:
  - **15分毎**: 全アイテムの価格取得 → 分析 → 異常検知 → 通知判定 → ニュース取得
  - **20秒毎**: 「いま閲覧されている銘柄（ホット）」の注文板を優先取得（株っぽい鮮度）
- 取得はSteamのレート制限内で逐次実行（`STEAM_REQUEST_INTERVAL_MS`）。

### C-2. 管理画面（/admin）
- 右上などから `/admin` へ。`ADMIN_TOKEN` を入力して操作:
  - **データ更新**（取得+分析を即実行） / **再分析のみ** / **キャッシュ削除** / 状況・ジョブログ確認
- API直叩き: `POST /api/admin/refresh`（ヘッダ `x-admin-token: <ADMIN_TOKEN>`）

### C-3. 主な環境変数（.env）
| 変数 | 既定 | 説明 |
|---|---|---|
| `STEAM_APP_ID` | 3678970 | Taskbar Hero のappid |
| `STEAM_CURRENCY` | 8 | 通貨（8=JPY, 1=USD, 16=KRW, 23=CNY） |
| `MARKET_REFRESH_CRON` | `*/15 * * * *` | 全体更新の間隔（分のみ解釈） |
| `HOT_REFRESH_MS` | 20000 | 閲覧中銘柄の注文板更新間隔 |
| `ADMIN_TOKEN` | — | 管理API用トークン |
| `NEXT_PUBLIC_SITE_URL` | — | 公開URL（SEO/OGに使用） |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | — | AdSense クライアントID（広告ON） |
| `DISCORD_WEBHOOK_URL` | — | Discord通知先 |

### C-4. 手動スクリプト
```bash
npm run fetch:market   # Steamから1回取得して保存
npm run analyze        # 分析を1回実行
npm run db:seed        # シード再投入（FORCE_SEED=true で再生成）
```

### C-5. 静的データ（demo.html / seed用）の再生成
`assets/` の実データを取り直す時（任意・開発端末で実行）:
```bash
node scripts/fetch-demo-assets.mjs   # 名前/アイコン/JPY価格
node scripts/fetch-tags.mjs          # class/level/parts/grade/type の実タグ
node scripts/fetch-orders.mjs        # 注文板スナップショット
node scripts/news-i18n.mjs           # ニュース翻訳
node scripts/build-demo.mjs          # demo.html へ注入
```

---

## D. サイトの使い方（利用者向け）

### 言語切替
- 右上の **Language**（既定=英語）。EN / 日本語 / 한국어 / 中文 / Русский。選択はブラウザに保存。
- 右上の **● LIVE** は配信接続状態。点滅＝リアルタイム受信中。

### ダッシュボード（トップ）
- 市場総額・出来高・本日値上がり/値下がり・異常検知・死亡アイテム
- お気に入りサマリ（損益合計など）
- **今買うべき / 売り時**ランキング、各種ランキングタブ、異常検知速報
- 市場更新があると**自動で最新化**（LIVE）

### アイテム一覧
- **検索**（名前）＋ **絞り込み**（Steam実フィルター: Type / Grade / Parts / Class / Level）
- **並び替え**（販売数量・価格・レベル・名前・投資スコア・7日変動／昇順降順）
- 行の **☆** でお気に入り登録、チェックで**複数比較**（合計・平均）

### アイテム詳細
- 基本情報・**注文板（売り板/買い板＝LIVE）**・価格推移グラフ・投資分析（スコア内訳・適正価格・割安率・移動平均・将来予測・AIコメント）
- **「Steamで見る」**で本物のSteam商品ページへ
- 価格通知（アラート）を設定可能
- ※「売買履歴」は**推定（合成）**表示。実取引履歴はSteam仕様上ログインが必要

### お気に入り
- **フォルダ**で分類、**メモ**、**購入価格**を保存 →**損益シミュレーション**（Steam手数料15%考慮）
- 「通知設定」タブ: 価格通知（以下/以上・前日比・急騰急落・出来高急増、通知先=Web/Discord/メール）
- 「通知履歴」タブ: 発火した通知の一覧

### ランキング / 異常検知 / ニュース
- **ランキング**: 今買うべき・売り時・値上がり・値下がり・売買数・高額・レア・人気
- **異常検知**: 急騰/急落/出来高急増・急減を自動検知
- **ニュース**: Taskbar Hero の公式Steamニュース（翻訳付き・原文リンク）

---

## E. デモHTML（サーバ不要のプレビュー）
`demo.html` をブラウザでダブルクリックするだけで、実データ・実アイコン・5言語・注文板まで入った単一ファイルのプレビューが動く（DB不要）。共用レンタルサーバーに置けばそのまま静的公開も可能。

---

## トラブルシューティング
| 症状 | 対処 |
|---|---|
| 起動直後DBに繋がらない | `db`のヘルスチェック通過を待つ（entrypointが自動リトライ） |
| 注文板が空 | そのアイテムに出品/買い注文が無い。または取得失敗→数十秒後に再取得 |
| 価格がおかしい | `STEAM_CURRENCY` が 8(JPY) か確認（23はCNY） |
| LIVEが点灯しない | Nginxで `/api/live` の `proxy_buffering off` を確認 |
| キャッシュが古い | 管理画面「キャッシュ削除」 |
