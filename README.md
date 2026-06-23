# Taskbar Hero — Steam Market Analytics

Steamコミュニティマーケットのゲーム **Taskbar Hero** 専用の市場分析プラットフォーム。
一般的なアイテム一覧サイトではなく、**Steamマーケット版の株式分析ツール**を目指す。

> 「何を買うべきか」「何を売るべきか」「市場で何が起きているか」を一目で判断できる。

![tech](https://img.shields.io/badge/Next.js-15-black) ![db](https://img.shields.io/badge/PostgreSQL-16-blue) ![orm](https://img.shields.io/badge/Prisma-6-2D3748) ![cache](https://img.shields.io/badge/Redis-7-DC382D)

---

## 主な機能

| カテゴリ | 機能 |
|---|---|
| データ取得 | Steamマーケット自動取得 (15分毎) / 手動更新 / 価格スナップショット蓄積 |
| 一覧・検索 | リアルタイム検索 / 複数条件絞り込み (種類・部位・グレード・クラス・価格・レベル) / ソート / ページング / 複数比較 |
| 詳細 | マーケット情報 / 価格推移グラフ (24h〜全期間) / 売買履歴 |
| 分析 | 移動平均(7/30/90日) / ボラティリティ / トレンド判定 / 投資スコア(100点) / 適正価格・割安率 / 将来価格予測 / AI分析コメント |
| ランキング | 今買うべき / 売り時 / 値上がり / 値下がり / 売買数 / 高額 / レア / 人気 |
| 異常検知 | 急騰・急落 (1h/24h/7d) / 出来高急増・急減 |
| お気に入り | 登録 / フォルダ分類 / メモ / 損益シミュレーション(手数料考慮) / 価格通知 |
| 通知 | ブラウザ / Discord Webhook / メール (条件: 価格・変動率・急騰急落・出来高) |
| ダッシュボード | 市場総額・活発度・急騰急落数・死亡アイテム / 各種ランキング / 異常速報 |
| 管理画面 | データ更新 / 再分析 / キャッシュ削除 / 状況確認 / ジョブログ |

---

## クイックスタート (Docker Compose のみ)

前提: Docker / Docker Compose が使えること。

```bash
cp .env.example .env       # 必要に応じて編集 (そのままでも動作)
docker compose up -d --build
```

起動シーケンス (自動):

1. `db` (PostgreSQL) と `redis` がヘルスチェック通過まで待機
2. `app` が起動時に **マイグレーション適用 → シード投入** (`docker/entrypoint.sh`)
3. `worker` が 15分毎に「取得 → 分析 → 通知判定」を実行

ブラウザで **http://localhost:3000** を開く。

> シードにより、ネットワーク無しでも 64 アイテム × 90日分の価格履歴と分析結果が入った状態で起動する。
> 実データを取得するには管理画面の「データ更新」または `worker` の自動実行を使う (下記「Steam取得について」参照)。

停止・破棄:

```bash
docker compose down          # コンテナ停止
docker compose down -v        # データ(ボリューム)も削除
```

---

## ローカル開発 (ホストで Next.js を実行)

DB / Redis だけ Docker で起動し、アプリはホストで動かす。

```bash
npm install
docker compose up -d db redis            # DB と Redis のみ
npx prisma migrate dev                    # スキーマ適用
npm run db:seed                           # シード投入
npm run dev                               # http://localhost:3000
```

`.env` の `DATABASE_URL` / `REDIS_URL` は `localhost` 向けに設定済み。

### 便利スクリプト

```bash
npm run db:seed         # シード再投入 (冪等 / FORCE_SEED=true で再生成)
npm run fetch:market    # Steam から1回取得して保存
npm run analyze         # 分析エンジンを1回実行
```

---

## アーキテクチャ

```
┌────────────┐   15分毎    ┌──────────────┐
│  worker    │────────────▶│ Steam Market │
│ (tsx loop) │   取得       └──────────────┘
└─────┬──────┘
      │ store + analyze + alert
      ▼
┌────────────┐   Prisma   ┌──────────────┐
│ PostgreSQL │◀──────────▶│   Next.js    │──▶ ブラウザ (App Router / RSC)
└────────────┘            │  app (3000)  │
┌────────────┐   cache    │  API Routes  │
│   Redis    │◀──────────▶│              │
└────────────┘            └──────────────┘
```

- **価格は最小通貨単位の整数**で保持 (JPYは円、USDはセント)。丸め誤差を避けるため Float 不使用。
- **変化率は basis points (bps, 100 = 1.00%)** で保持。
- 分析エンジンは純粋関数 (`src/lib/analysis/core.ts`) と DB連携層 (`engine.ts`) に分離。

### ディレクトリ

```
src/
  app/                   App Router (ページ + API Routes)
    api/                 items / dashboard / rankings / favorites / folders / alerts / notifications / anomalies / admin
  components/            UI (shadcn風プリミティブ + ドメイン部品)
  lib/
    analysis/core.ts     分析の純粋関数 (MA/ボラ/スコア/異常/予測/コメント)
    analysis/engine.ts   分析のDB連携 (ItemAnalysis upsert / Anomaly記録)
    steam/               取得 (fetch) / 分類 (classify) / 保存 (store)
    queries.ts           一覧・ランキング・サマリのデータアクセス
    favorites.ts         お気に入り・損益・フォルダ
    alerts.ts            アラート評価・通知送信
    jobs.ts              取得→分析→通知 のオーケストレーション
prisma/
  schema.prisma          データモデル
  seed.ts                合成シードデータ生成
scripts/
  worker.ts              自動更新ワーカー
  fetch-market.ts        手動取得
  run-analysis.ts        手動分析
docs/
  ER.md                  ER図
  API.md                 API仕様書
  DEPLOY.md              デプロイ手順書
```

---

## 投資スコア (100点満点)

| 要素 | 配点 | 評価内容 |
|---|---|---|
| 価格推移 | 25 | 割安度 + 上昇トレンド |
| 出来高 | 25 | 取引の活発さ (対数スケール) |
| 安定性 | 20 | トレンドの緩やかさ |
| ボラティリティ | 15 | 価格変動の小ささ |
| 市場人気度 | 15 | 出来高分布 + お気に入り数 |

判定: `0-39 危険 / 40-59 注意 / 60-79 良好 / 80-100 有望`
推奨度: `S (80+) / A (65+) / B (45+) / C`

---

## Steam取得について

`STEAM_APP_ID` (既定 3678970 = Taskbar Hero) のマーケットを
`/market/search/render/` でページ走査して取得する。

- 売買履歴 (`/market/pricehistory/`) は通常ログインCookieが必要。
  `STEAM_LOGIN_COOKIE` を設定した場合のみ取得し、未設定時はスナップショットの蓄積が履歴を代替する。
- 取得はレート制限回避のため `STEAM_REQUEST_INTERVAL_MS` (既定3.5s) 間隔で逐次実行。
- 対象アプリにマーケットが存在しない/取得失敗時は、既存データで分析のみ続行する (ジョブは失敗しない)。

---

## 環境変数

`.env.example` 参照。主なもの:

| 変数 | 既定 | 説明 |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL接続文字列 |
| `REDIS_URL` | — | Redis接続 (未設定ならキャッシュ無しで動作) |
| `STEAM_APP_ID` | 3678970 | 対象ゲームのappid |
| `STEAM_CURRENCY` | 8 | 通貨コード (8=JPY, 16=KRW, 23=CNY, 1=USD) |
| `STEAM_REQUEST_INTERVAL_MS` | 3500 | 取得間隔 |
| `MARKET_REFRESH_CRON` | `*/15 * * * *` | worker の更新間隔 (分のみ解釈) |
| `ADMIN_TOKEN` | — | 管理API用トークン (未設定なら開発用に許可) |
| `DISCORD_WEBHOOK_URL` | — | Discord通知先 |
| `SEED_ON_START` | true | 起動時シード (本番は false 推奨) |

---

## ドキュメント

- **[現状まとめ STATUS.md](docs/STATUS.md)** ← まずこれ（実装/未実装・検証状況の単一ソース）
- [使い方ガイド GUIDE.md](docs/GUIDE.md)
- [監査レポート AUDIT.md](docs/AUDIT.md)（セキュリティ/SRE・チェックリスト・コスト）
- [広告システム ADS.md](docs/ADS.md)
- **[Xserver VPSデプロイ手順 DEPLOY-VPS.md](docs/DEPLOY-VPS.md)** ← 公開時はこれをコピペ
- [デプロイ手順（汎用）DEPLOY.md](docs/DEPLOY.md)
- [ER図](docs/ER.md) / [API仕様書](docs/API.md)

---

## ライセンス / 注意

本ツールは Steam の非公式分析ツール。Steam のリクエストレート制限を遵守すること。
Valve / Steam の商標は各権利者に帰属する。
