# プロジェクト現状（最終更新 2026-06-15 / リリース準備版）

精査用のスナップショット。**検証済みのことだけ「済」と書く。未検証は理由つきで未検証と書く。**

---

## 0. 結論（3行）
- **コードは完成し、`tsc`（型エラー0）/ `next build`（全ルート成功・lint通過）/ `prisma validate`（OK）を通過している。リリース可。**
- **ただし「DBを起動して実際に動かすE2E」は一度も実行していない。** 理由: この作業環境の Docker Desktop が不安定で起動が落ちるため。
- 公開前に必要なのは「コードの追加実装」ではなく「VPS上での初回起動と動作確認」という運用作業（手順は [DEPLOY-VPS.md](DEPLOY-VPS.md)）。

---

## 0.5 リリース準備サマリ（2026-06-15）

**コード側は準備完了。残りは①VPS用意 ②本番ENV設定 ③初回起動の3点（あなたの作業）。**

直近の主な変更（このリリースに含む）:
- ホーム=アイテム一覧（旧ダッシュボードは `/dashboard`、`/items`→`/` リダイレクト）。ナビ順 = 一覧/ランキング/ダッシュボード/お気に入り/異常検知/ニュース
- マーケット最終更新時刻を一覧に表示（本番=`getLastUpdated()`、15分毎更新の明記）
- クラスアイコン（フィルタ/詳細/一覧行）＋クラス選択で背景アート（単一＋特定3コンボ、画像は contain で全体表示）
- ライト(白)テーマ切替（右上ボタン）。白地での淡色/黄文字を可読化（demo）
- 監視/エラー収集（`monitoring.ts`・env未設定ならログのみ）
- レア度順の修正（…ビヨンド/アルカナ/イモータル/レジェンダリー…）
- スマホ/タブレット最適化（モバイルナビ・1カラム化）

検証（このPC）: `tsc`=0 / `next build`=成功 / `prisma validate`=OK / demoは主要動作をブラウザ確認。
**未検証**: 実DBでのE2E（§5）。`.gitignore` は `.env` 除外済（秘密情報は漏れない）。Gitは**未初期化**（リリース前に `git init`→GitHub push が必要 / [DEPLOY-VPS.md](DEPLOY-VPS.md) §0）。

**公開前に必ず設定する本番ENV**（[.env.example](../.env.example) 参照）:
`POSTGRES_PASSWORD` / `DATABASE_URL`(ホストは`db`) / `ADMIN_TOKEN` / `NEXT_PUBLIC_SITE_URL` / `STEAM_CURRENCY=8` / `SEED_ON_START`（初回true→後でfalse） / 広告は当面 `NEXT_PUBLIC_ADS_ENABLED=false`。

---

## 1. 成果物は2つある（混同しないこと）

### A. `demo.html`（単一ファイルの静的プレビュー）
- ブラウザでダブルクリックすれば動く。サーバ・DB不要。
- 中身は **2026-06-13 17:10 UTC 時点のSteam実データのスナップショット**（166アイテム／うち価格190件・注文板100件）。
- 用途: 見た目・操作・機能の確認。**本番サイトではない。**
- 弱点: 価格は取得時点の固定値。Steam再開直後で相場が分単位で動くため、ライブのSteam価格とはすぐズレる（これは仕様。安定品Leatherはライブと一致＝計算は正しい）。

### B. Next.js アプリ（本番公開する本体）
- `D:\Claude\taskbar-hero-market`。Docker Compose で起動する。
- demo.html の全機能を **ライブ（15分自動更新＋注文板20秒）** で持ち、加えて本番ハードニング・広告・SEO・リアルタイム配信が入る。
- **まだDBを繋いで起動したことはない**（§0の理由）。

---

## 2. 技術スタック（事実）
- フロント/サーバ: **Next.js 15（App Router）/ TypeScript / Tailwind**
- DB: **PostgreSQL + Prisma**（Supabaseではない）
- キャッシュ/配信: **Redis**（キャッシュ・SSE pub/sub・レート制限の一部）
- 実行: **Docker Compose**（db / redis / app / worker の4サービス）
- 想定ホスト: **Xserver VPS**（Vercelではない）
- 対象ゲーム: Steam appid **3678970**（Taskbar Hero）。通貨 **8 = JPY**。

> 注意: 過去のやり取りで Supabase / Vercel を前提にした監査指示があったが、本プロジェクトは上記スタック。該当部分は読み替えて対応済み（[AUDIT.md](AUDIT.md) §2,§8,§9）。

---

## 3. 機能の実装状況

凡例: ✅実装済(型/ビルド通過) ／ ⚠️実装済だが実DBで未動作確認 ／ ❌未実装

| 機能 | demo.html | Next.jsアプリ | 備考 |
|---|---|---|---|
| アイテム一覧（検索/絞込/ソート/比較） | ✅ | ⚠️ | フィルタはSteam実ファセット(Type/Grade/Parts/Class/Level) |
| アイテム詳細（基本情報/分析/AIコメント） | ✅ | ⚠️ | |
| 価格チャート | ✅(横軸ラベルあり) | ⚠️(Recharts) | demoの履歴は合成（実取引履歴はSteamログイン必須のため）。明記済 |
| 注文板（売り板/買い板） | ✅(スナップショット) | ⚠️(LIVE取得) | アプリは閲覧時にサーバ側でSteamから取得→Redis 60秒キャッシュ |
| ダッシュボード/ランキング/異常検知 | ✅ | ⚠️ | |
| ニュース（Steam公式・翻訳） | ✅(翻訳6件埋込) | ⚠️(取得+翻訳枠) | アプリは GetNewsForApp を取得しNewsArticleに保存。翻訳は原文+手動訳の枠組み |
| 多言語 EN/JA/KO/ZH/RU（既定EN） | ✅ | ✅ | アプリはcookieロケール。**UIの日本語固定は解消済**（alert-form/チャート期間タブも対応） |
| 購入/販売モード（サイト全体） | ✅ | ✅ | 右上トグル。ダッシュボード/詳細/注文板/ランキングが切替 |
| お気に入り/フォルダ/メモ/損益/通知 | △(ブラウザ内のみ) | ⚠️(DB保存) | demoは永続化なし。アプリはDB＋通知(Web/Discord/メール枠) |
| リアルタイム配信(SSE) | ❌(静的) | ⚠️ | `/api/live`＋Redis pub/sub。topbarに●LIVE。ホット銘柄20秒更新 |
| 広告（AdSense一元管理） | ❌ | ✅ | AdBanner/Sidebar/InContent/Mobile。CLS対策・遅延読込・ON/OFF・計測 |
| 「Steamで見る」リンク | ✅ | ✅ | 実商品ページへ |
| 管理画面（更新/再分析/キャッシュ/ログ） | ❌ | ⚠️ | トークン認可（本番は必須） |

---

## 4. 本番ハードニング（監査対応）

すべて Next.js アプリに実装済・型/ビルド通過。**実DBでの動作確認は未**。

| 項目 | 実装 | ファイル |
|---|---|---|
| セキュリティヘッダ/CSP | ✅ | `next.config.ts` |
| APIレート制限（IP別・429） | ✅ | `src/middleware.ts`（in-memory・単一VPS前提） |
| 管理API認可（本番でトークン必須・定数時間比較） | ✅ | `src/lib/admin-auth.ts` |
| 入力検証（enum許可リスト・数値clamp） | ✅ | `src/lib/queries.ts` |
| Steam取得の指数バックオフ+タイムアウト | ✅ | `src/lib/steam/http.ts` |
| Error Boundary / 500 / 404 | ✅ | `src/app/error.tsx` `global-error.tsx` `not-found.tsx` |
| SEO（sitemap/robots/詳細metadata+canonical） | ✅ | `src/app/sitemap.ts` `robots.ts` |
| DB外部非公開化（ポートをlocalhostバインド） | ✅ | `docker-compose.yml` |
| 監視/エラー収集（Sentry/Webhook・env未設定ならログのみ） | ✅ | `src/lib/monitoring.ts` ＋ `api/client-error` |

詳細は [AUDIT.md](AUDIT.md)。

---

## 5. 検証状況（事実）

| 検証 | 実施 | 結果 |
|---|---|---|
| `tsc --noEmit`（型チェック） | 済 | エラー0 |
| `next build`（本番ビルド） | 済 | 全ルート成功（Middleware/sitemap/robots含む） |
| demo.html の全画面×5言語の描画 | 済（Nodeハーネス） | OK |
| 価格の正しさ（単位・通貨） | 済 | 正しい（安定品Leatherがライブ一致で証明） |
| **DBマイグレーション適用** | **未** | Docker(Postgres)必須・当環境のDocker不安定で未実行 |
| **実データseed→アプリ起動→画面表示** | **未** | 同上 |
| Lighthouse（性能スコア） | 未 | 本番環境で計測が必要 |

---

## 6. 未実装・未対応（正直リスト）

- ❌ **実DBでの起動確認**（最重要・運用作業）。VPSで `docker compose up -d --build` → `docker compose logs -f app` でマイグレ/seed/worker稼働を目視。
- ✅ **監視/エラー収集の実コード組込**（`src/lib/monitoring.ts`）。env未設定なら構造化ログのみ、`SENTRY_DSN` か `MONITORING_WEBHOOK_URL`（Discord可）設定で実送信。クライアント境界→`/api/client-error`、サーバはjobs/workerの例外を捕捉。管理状態APIに `monitoring` 状態を表示。
- ❌ **本番ENVの設定**（`ADMIN_TOKEN`・`NEXT_PUBLIC_SITE_URL`・`SEED_ON_START=false`・AdSense ID・`NEXT_PUBLIC_ADS_ENABLED`）。
- ❌ **ニュースの全文翻訳**（現状は原文＋要約手動訳の枠組み。機械翻訳API連携は未）。
- ❌ **アイテム名の翻訳**（Steamに公式訳が無いため英語のまま＝設計判断。やるなら自前辞書）。
- ⚠️ **レート制限はin-memory**（単一VPS用）。アプリを複数台に増やすならRedis/Upstashへ移行が必要。
- ⚠️ **AdSenseのクリック計測**はサイト側から取得不可（iframe越し）。表示/可視までは計測、クリックは管理画面で確認（[ADS.md](ADS.md)）。

---

## 7. 公開までの手順（やる順）

1. VPS（Xserver VPS 8GB目安）に Docker / Docker Compose を導入。
2. リポジトリ配置→`.env` を本番値に（§6のENV）。
3. `docker compose up -d --build` →`docker compose logs -f app` で起動確認（**ここが未検証の山場**）。
4. Nginx + certbot で HTTPS。`/api/live` は `proxy_buffering off`（[DEPLOY.md](DEPLOY.md)）。
5. `db` のポート公開を削除（完全閉鎖）。`SEED_ON_START=false`。
6. AdSense審査通過後 `NEXT_PUBLIC_ADS_ENABLED=true` ＋ slot ID。
7. Lighthouse計測→必要なら調整。

ロールバック手順は [AUDIT.md](AUDIT.md) §8-5。

---

## 8. ドキュメント一覧
- [README.md](../README.md) … 概要・起動
- [GUIDE.md](GUIDE.md) … 使い方（運用者+利用者）
- [DEPLOY.md](DEPLOY.md) … デプロイ（Nginx/HTTPS/SSE）
- [AUDIT.md](AUDIT.md) … セキュリティ/SRE監査・チェックリスト・コスト
- [ADS.md](ADS.md) … 広告システム
- [ER.md](ER.md) / [API.md](API.md) … データモデル / API仕様
- **このファイル（STATUS.md）** … 現状の単一ソース
