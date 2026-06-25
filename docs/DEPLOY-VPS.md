# Xserver VPS デプロイ手順（詳細版・コピペ用）

このゲーム市場分析サイトを **Xserver VPS（Ubuntu + Docker）** で公開するための完全手順。
コマンドはほぼコピペで動きます。`<...>` の部分だけ自分の値に置き換えてください。

> 前提知識: SSHでサーバにログインできること。Linux/Dockerの深い知識は不要（このページ通りで動きます）。

---

## 0. 完成イメージ / 構成

```
                 ┌─────────────────────── VPS (Ubuntu) ───────────────────────┐
   インター       │                                                            │
   ネット ──443──▶│  Nginx ──(リバースプロキシ)──▶ app:3000 (Next.js)          │
         (HTTPS)  │    │                              │                        │
                  │    └─ /api/live は buffering off  ├─ db (PostgreSQL:5432)  │  ← 127.0.0.1のみ
                  │                                    ├─ redis (6379)          │  ← 127.0.0.1のみ
                  │                                    └─ worker (15分毎更新)   │
                  └────────────────────────────────────────────────────────────┘
```

- **4コンテナ**: `db`(PostgreSQL16) / `redis`(7) / `app`(Next.js) / `worker`(15分毎にSteam取得→分析→通知)。
- `db`・`redis`・`app` は **127.0.0.1 のみにバインド**（外部非公開）。外からは Nginx 経由のみ。
- 広告は**既定OFF**。後から3行の設定＋再ビルドでON（§12）。

**推奨スペック**:
- このアプリ単体＋低トラフィックなら **Xserver VPS 2GBプラン（vCPU3コア / メモリ2GB / NVMe SSD 50GB・月額830円〜）で十分**。※稼働メモリは約0.7〜1GB。**ビルド時にメモリを食うのでスワップ必須**（§2）。
- 他プロジェクトも複数同居させるなら **4GB以上**が快適。
- 価格・スペックは時期で変動。最新は公式（[vps.xserver.ne.jp](https://vps.xserver.ne.jp/)）で確認。

---

## 1. VPS契約と初回ログイン

1. Xserver VPS で **2GBプラン**（または4GB）を契約。
2. **イメージ選択**（どちらでもOK）:
   - **A. 「Docker」アプリイメージを選ぶ（おすすめ・楽）** → Docker導入済みで起動するので §2 のDocker導入を省略できる。ベースはUbuntu。
   - **B. OSで Ubuntu 24.04（または22.04）を選ぶ** → §2 で自分でDockerを入れる。
3. 契約時に **root パスワード** を設定。VPSの **IPアドレス** を控える。210.131.223.41
4. 手元のPCからSSH接続（初期ユーザーは root / ポート22）:
   ```bash
   ssh root@210.131.223.41
   ```

> **重要（Xserver固有）**: Xserver VPSは**コントロールパネルの「パケットフィルター」**という独自ファイアウォールがあります。まず §1.5 でこれを設定しないと、SSH以外（HTTP/HTTPS）が通らない、または逆に全開放のままになります。

### 作業用ユーザーを作る（rootで直接作業しない）
```bash
adduser deploy                 # パスワードを設定（他は空Enterで可）
usermod -aG sudo deploy        # sudo権限付与
# （SSH鍵を使うなら）rootの鍵をコピー
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```
以降は `deploy` ユーザーでログインし直します:
```bash
exit
ssh deploy@210.131.223.41
```

---

## 1.5 パケットフィルター設定（Xserver パネル・必須）

Xserver VPS は**コントロールパネル側にもファイアウォール（パケットフィルター）**があります。ここで許可しないとHTTP/HTTPSが外から届きません。

1. [Xserver VPS パネル](https://secure.xserver.ne.jp/xapanel/login/xvps/)にログイン → 対象VPS → 左メニュー **「パケットフィルター設定」**。
2. **「ONにする（推奨）」** にチェック → 変更。
3. **「パケットフィルター設定を追加する」** で以下のプリセットを追加:
   - **SSH**（22/TCP）← これを入れ忘れるとSSHできなくなるので**必ず最初に**
   - **Web**（選ぶと **HTTP=80 と HTTPS=443 の両方**が開く）
4. **5432 / 6379 / 3000 は追加しない**（DB/Redis/appは外部公開しないため）。

> SSHポートを22から変えた場合は、ここにも**そのポート番号**を「指定ポート」で追加してください（22のSSHプリセットだけだと新ポートが塞がれてログイン不能になります）。
> OS側の `ufw`（§2）と二重になりますが、**両方で 22/80/443 を許可していれば問題ありません**。片方だけ閉じると締め出されるので、SSHは必ず両方で許可。

---

## 2. サーバ初期設定

```bash
# 1) パッケージ更新
sudo apt update && sudo apt -y upgrade

# 2) タイムゾーン（任意・ログが見やすくなる）
sudo timedatectl set-timezone Asia/Tokyo

# 3) スワップ作成（★2GBプランは必須。next build がメモリを食ってOOMするのを防ぐ）
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
free -h                    # Swap が 2.0Gi 出ればOK

# 4) OS側ファイアウォール ufw（§1.5のパネル側パケットフィルターに加えた二重防御）
#    ※SSHは必ず許可（締め出し防止）。SSHポートを変えたら OpenSSH ではなくそのポートを許可。
sudo apt -y install ufw
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
sudo ufw status            # 22,80,443 のみ ALLOW を確認（5432/6379/3000は出さない）
```

```bash
# 5) Docker + Compose プラグイン
#    ★ §1で「Docker」アプリイメージを選んだ場合は導入済みなので、この手順5は丸ごとスキップ。
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # sudo無しで docker 実行可に
```
**一度ログアウト→再ログイン**（dockerグループを反映）。確認:
```bash
docker run --rm hello-world       # "Hello from Docker!" が出ればOK
docker compose version            # v2 が出ればOK
```

---

## 3. ドメインとDNS

1. ドメインを用意（年¥1,000〜3,000）。
2. DNSの **Aレコード** を VPS の IP に向ける:
   | ホスト | 種類 | 値 |
   |---|---|---|
   | `@`（または `taskbarhero`） | A | `<VPSのIP>` |taskbarhero.space
   | `www`（任意） | A | `<VPSのIP>` |
3. 反映確認（数分〜数十分）:
   ```bash
   dig +short taskbarhero.space     # VPSのIPが返ればOK
   ```

---

## 4. ソース配置

### GitHubから（推奨）
手元のPCでまだpushしていなければ:
```bash
# 手元のプロジェクトフォルダで
git init && git add -A && git commit -m "init"
git branch -M main
git remote add origin git@github.com:get2437/musicAI.git
git push -u origin main
```
VPS側:
```bash
cd ~
git clone https://github.com/get2437/taskbar-hero-market.git
cd taskbar-hero-market
```

> privateリポジトリなら、VPSにデプロイキーを登録するか、`https://<token>@github.com/...` でclone。

---

## 5. 環境変数 `.env` を作成

```bash
cp .env.example .env
nano .env
```

**最低限ここだけ自分の値に**（強いランダム値は下のコマンドで生成）:
```bash
openssl rand -base64 32     # POSTGRES_PASSWORD 用
openssl rand -hex 32        # ADMIN_TOKEN 用
```

`.env` の本番設定:
```env
# ---- DB ----
POSTGRES_USER=taskbar
POSTGRES_PASSWORD=<openssl rand -base64 32 の出力>
POSTGRES_DB=taskbar_hero
# ↓ ホストは必ず "db"（compose内サービス名）。localhost ではない！
DATABASE_URL=postgresql://taskbar:<上と同じパスワード>@db:5432/taskbar_hero?schema=public

# ---- Redis ----
REDIS_URL=redis://redis:6379

# ---- Steam ----
STEAM_APP_ID=3678970
STEAM_CURRENCY=8            # 8=JPY（23はCNYなので注意）

# ---- App ----
ADMIN_TOKEN=<openssl rand -hex 32 の出力>
SEED_ON_START=true         # 初回だけ true。実データ投入後に false へ（§5-2）

# ---- 公開URL / SEO ----
NEXT_PUBLIC_SITE_URL=https://<あなたのドメイン>
NEXT_PUBLIC_STEAM_APP_ID=3678970
NEXT_PUBLIC_STEAM_CURRENCY=8

# ---- 広告（当面OFF。§12でON）----
NEXT_PUBLIC_ADS_ENABLED=false

# ---- ニュース自動翻訳（任意）----
# 設定するとSteam公式ニュースの新着を Claude API で9言語へ自動翻訳して保存します。
# 未設定なら記事は英語原文のまま表示（翻訳は行われません）。
# キーは https://console.anthropic.com で発行。ワーカーが新着検出時だけ呼ぶので低コストです。
ANTHROPIC_API_KEY=

# ---- 監視（任意）----
# 設定すると例外をSentry/Discordへ送信。未設定なら構造化ログのみ。
SENTRY_DSN=
MONITORING_WEBHOOK_URL=

# ---- 通知（任意）----
DISCORD_WEBHOOK_URL=
```
保存（nano: `Ctrl+O` → `Enter` → `Ctrl+X`）。

> **重要**: `.env` は `.gitignore` 済で GitHub には上がりません。秘密情報はVPSの `.env` だけに置きます。

---

## 6. 起動（ここが本番の山場）

```bash
★ここが上手くいかなかった
docker compose up -d --build       # 初回はビルドに時間がかかる（2GBプランはスワップ利用で5-15分・固まらず通る）
docker compose ps                  # 4サービスが Up / healthy になるか確認
docker compose logs -f app         # appの起動ログを追う
```

`app` ログで以下が**順に**出れば成功:
```
[entrypoint] Waiting for database...
[entrypoint] Migrations applied.            ← マイグレーション適用OK
[entrypoint] Seeding (idempotent)...
[seed] source = REAL assets/market.json ...
[seed] done. analyzed=... anomalies=...     ← 実データ投入OK
 ▲ Next.js ...  Ready                        ← 起動完了
```
`Ctrl+C` でログ表示を抜ける（コンテナは動き続けます）。

`worker` も確認:
```bash
docker compose logs --tail=30 worker
# [worker] started. full refresh = 15 min / hot refresh = 20s / monitoring = log-only
# [worker] done: fetched=... analyzed=... ...
```

サーバ内から動作確認:
```bash
curl -sI http://127.0.0.1:3000 | head -1     # HTTP/1.1 200 OK
```

### 5-2. seed後に SEED_ON_START を false へ
実データ投入が済んだら、毎回seedしないように:
```bash
sed -i 's/SEED_ON_START=true/SEED_ON_START=false/' .env
docker compose up -d               # appだけ再作成（データは保持）
```
> seedは冪等（既にItemがあればスキップ）なので true のままでも壊れませんが、起動が速くなるので false 推奨。

---

## 7. Nginx + HTTPS

DNSがVPSに向いていることを確認してから:

```bash
sudo apt -y install nginx
sudo nano /etc/nginx/sites-available/taskbarhero
```
内容（`<あなたのドメイン>` を置換）:
```nginx
server {
  listen 80;
  server_name taskbarhero.space;

  # アップロードや長いレスポンスの余裕
  client_max_body_size 2m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # リアルタイム配信(SSE)はバッファ無効が必須（●LIVE が点く）
  location /api/live {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
  }
}
```
有効化:
```bash
sudo ln -s /etc/nginx/sites-available/taskbarhero /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default     # 既定ページを無効化
sudo nginx -t && sudo systemctl reload nginx
```
HTTPS化（Let's Encrypt 無料証明書・自動更新付き）:
```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d taskbarhero.space
# メール入力 → 規約同意(A) → HTTPSリダイレクトは "2"(有効) を選ぶ
```
証明書の自動更新テスト:
```bash
sudo certbot renew --dry-run
```

---

## 8. 公開後の動作確認チェックリスト

ブラウザ/コマンドで:
- [ ] `https://<ドメイン>/` が **アイテム一覧（ホーム）** で開く
- [ ] `https://<ドメイン>/robots.txt` と `/sitemap.xml` が 200
- [ ] アイテムをクリック → 詳細・注文板・チャートが出る。右上に購入/販売トグル
- [ ] トップバーの **●LIVE** が点灯（SSE疎通）。`/api/live` の buffering off を確認
- [ ] クラスを1つ選ぶと一覧に背景アート、特定の複数選択でコンボ背景
- [ ] 管理API（要トークン）:
  ```bash
  curl -s https://<ドメイン>/api/admin/status -H "Authorization: Bearer <ADMIN_TOKEN>" | head
  # counts / lastUpdated / monitoring / logs が返る
  ```

---

## 9. バックアップ（DB）

```bash
# 手動バックアップ
docker compose exec -T db pg_dump -U taskbar taskbar_hero > ~/backup_$(date +%F).sql

# 毎日3時に自動（cron）
( crontab -l 2>/dev/null; echo "0 3 * * * cd ~/taskbar-hero-market && docker compose exec -T db pg_dump -U taskbar taskbar_hero > ~/backup_\$(date +\%F).sql && find ~ -name 'backup_*.sql' -mtime +14 -delete" ) | crontab -
```
復元（※既存データは置き換わるので注意）:
```bash
cat ~/backup_YYYY-MM-DD.sql | docker compose exec -T db psql -U taskbar taskbar_hero
```
> 重要データなら、`scp` 等で**別の場所にも**コピーしておくと安心（VPS故障対策）。

---

## 10. 監視・ログ

- **コンテナログ**: `docker compose logs -f app` / `worker` / `db`。直近だけは `--tail=100`。
- **エラー収集**: `.env` に `SENTRY_DSN`（Sentry）か `MONITORING_WEBHOOK_URL`（Discord等）を設定 → `docker compose up -d` で有効化（NEXT_PUBLICではないので再ビルド不要）。未設定でも構造化ログには出ます。
- **ヘルスチェック**: `GET /api/health`（トークン不要・DB ping付き）を Uptime監視サービスに登録。OKなら200/`{"status":"ok","db":true}`、DB不通なら503。
  ```bash
  curl -s https://<ドメイン>/api/health      # {"status":"ok","db":true,...}
  ```
- **データ鮮度**: `GET /api/admin/status`（要トークン）の `lastUpdated` が15分以内に更新されているか。
- **リソース**: `docker stats`（メモリ/CPU）。`df -h`（ディスク）。

---

## 11. 更新デプロイ / ロールバック

更新:
```bash
cd ~/taskbar-hero-market
git pull
docker compose up -d --build      # 新マイグレーションは起動時に自動適用
docker compose logs -f app        # Migrations applied / Ready を確認
```
ロールバック:
```bash
git checkout <戻したいコミットID または タグ>
docker compose up -d --build
# DBに破壊的変更が含まれた場合のみ §9 のバックアップから復元
```
> リリース毎に `git tag v1.0.0` を打っておくとロールバック先が明確になります。

---

## 12. 広告を後でONにする（人が増えたら）

広告のコード・配置・遅延読込・CLS対策・「Ad」表示・同意バナー(CMP)は**すべて実装済み**。やるのは「AdSense手続き」と「env設定＋再ビルド」だけです。
NEXT_PUBLIC_* は**ビルド時に埋め込まれる**ため、ON/OFFには再ビルドが必要です（compose の build args で `.env` から自動的に渡る設定済み）。

### 12-0. 先に枠位置だけ確認（AdSense不要・任意）
`.env` に `NEXT_PUBLIC_ADS_PLACEHOLDER=true` を入れて `docker compose up -d --build` → 各配置に破線の「**Ad · placement**」枠が出る。レイアウト崩れ(CLS)を事前に確認できる。確認後は `false` に戻す。

### 12-1. AdSense 手続き
1. [Google AdSense](https://adsense.google.com) に登録 → **サイト審査に通過**（公開中のサイト・独自コンテンツ・プライバシーポリシーが必要。本サイトは `/privacy` あり）。
2. パブリッシャーID `ca-pub-xxxxxxxxxxxxxxxx` を取得。
3. 広告ユニットを作成 → **スロットID（10桁）** を取得（まず1つでOK）。

### 12-2. env 設定 → 再ビルド
```env
NEXT_PUBLIC_ADS_ENABLED=true
NEXT_PUBLIC_ADS_PLACEHOLDER=false
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_AD_SLOT_DEFAULT=xxxxxxxxxx     # まず共通スロット1つでOK（全配置がこれにフォールバック）
```
```bash
docker compose up -d --build   # --build 必須（NEXT_PUBLIC_* を焼き込む）
```

### 12-3. ads.txt（自動）
`https://<ドメイン>/ads.txt` が `google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0` を自動で返す（`ADSENSE_CLIENT` から生成）。AdSense管理画面の ads.txt 警告が消えることを確認（反映に数時間〜1日）。

### 12-4. 同意バナー（CMP / Consent Mode v2）
- ADS_ENABLED=true のとき、未選択ユーザーに同意バナーを自動表示（9言語）。既定の consent は `denied`、同意後のみ `granted`（パーソナライズ広告）。拒否でも非パーソナライズ広告は配信。
- **EEA/UK 配信があるなら**、AdSense管理画面 →「プライバシーとメッセージング」で **Google認定CMP（GDPRメッセージ）も有効化**推奨（IAB TCF完全準拠用）。本実装は Consent Mode の基本連携。

### 配置ごとに別スロットにしたい場合（任意）
`NEXT_PUBLIC_AD_SLOT_HOME_TOP` 等を `.env` に追加し、`docker-compose.yml` の `app.build.args` と `Dockerfile` の `ARG/ENV` にも同名を足す（DEFAULTにフォールバックするので必須ではない）。
配置一覧: home_top / home_bottom / items_top / items_bottom / detail_chart / detail_related / rankings_top / rankings_bottom / sidebar / mobile_anchor。

> **OFFに戻す**: `NEXT_PUBLIC_ADS_ENABLED=false` にして再ビルド。OFF時は広告枠もスクリプトも同意バナーも一切出ません。

---

## 12.5 アクセス解析（訪問数・国別の確認）

訪問数・ページビュー・**国別**・流入元を見るための **Plausible 互換の解析が実装済み**（Cookie不使用＝同意バナー不要）。`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` を設定して再ビルドすれば計測スクリプトが入る。未設定なら一切読み込まない。

### 方法A: Plausible Cloud（簡単・有料 約$9/月）
1. [plausible.io](https://plausible.io) でアカウント作成 → サイト（あなたのドメイン）を追加。
2. `.env`:
   ```env
   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=example.com    # あなたのドメイン
   # NEXT_PUBLIC_PLAUSIBLE_SRC は未指定でOK（既定で plausible.io のスクリプト）
   ```
3. `docker compose up -d --build` → Plausible 管理画面で訪問数・国・人気ページが見られる。

### 方法B: 自前ホスト（無料・要構築）
Plausible Community Edition を自分のサーバ（同VPSの別コンテナ等）に立て、`.env` に:
```env
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=example.com
NEXT_PUBLIC_PLAUSIBLE_SRC=https://<自前Plausible>/js/script.js
```
→ 再ビルド。

### Google Analytics(GA4) を使う場合（任意）
GA4 は Cookie を使うため**同意が必要**（本サイトの同意バナーが対象）。GA4 を入れるなら layout に gtag を追加し、Consent Mode の `analytics_storage` と連携する（Plausible で十分なら不要）。

> **広告の数字（表示回数・クリック・収益）は AdSense 管理画面**で国別・ページ別に確認する（クリックはクロスオリジン枠内で発生するためサイト側からは取得不可）。本サイトは「枠の表示/50%可視」のみ計測し、gtag/dataLayer があればそこへ送出する。

---

## 13. 性能・スケールの注意

- **レート制限はin-memory**（`src/middleware.ts`）。**単一VPS前提**。appを複数台に増やすなら Redis ベースへ要変更。
- **worker は1つだけ**動かすこと（複数起動すると二重取得）。compose の worker は1レプリカ前提。
- Lighthouse は本番URLで計測（広告OFF時に良好なはず）。
- メモリが厳しい時: `.env` の `HOT_REFRESH_MS` を伸ばす／`STEAM_REQUEST_INTERVAL_MS` を上げて取得負荷を下げる。

---

## 14. トラブルシューティング

| 症状 | 原因/対処 |
|---|---|
| `app` がDB接続エラーで再起動ループ | `db` のhealthcheck通過待ち。`docker compose logs db`。`.env` の `DATABASE_URL` のホストが **db** か確認 |
| `seed` が走らない/重複 | 既にItemがあるとスキップ（冪等）。作り直すなら `FORCE_SEED=true docker compose run --rm app node_modules/.bin/tsx prisma/seed.ts` |
| ●LIVE が点かない | Nginx `/api/live` の `proxy_buffering off` を確認。`docker compose logs app` でSSEエラー有無 |
| 価格がおかしい | `.env` の `STEAM_CURRENCY=8`(JPY) か確認（23はCNY） |
| 502 Bad Gateway | appが起動前/落ちている。`docker compose ps` と `logs app`。3000で200が返るか `curl -sI http://127.0.0.1:3000` |
| HTTPS証明書が取れない | DNSがVPSに向いているか `dig +short <ドメイン>`。80番がufwで開いているか |
| 広告を入れたのに出ない | `docker compose up -d --build`（**--build必須**）。AdSense審査通過済みか。ブラウザの広告ブロッカーOFFで確認 |
| メモリ不足でビルドが固まる | スワップ（§2-3）を有効化。または手元でビルド→イメージをpush |
| `docker compose` が無い | 旧 `docker-compose`（ハイフン版）ではなく v2 の `docker compose`。§2でDocker再導入 |

---

## 15. セキュリティ最終チェック

- [ ] **Xserver パケットフィルター**（§1.5）が ON で **SSH + Web のみ**許可（パネルで確認）
- [ ] `ufw status` が **22 / 80 / 443 のみ** ALLOW（5432/6379/3000 は出ていない）
- [ ] SSHは**パネル側・ufw側の両方**で許可されている（締め出し防止）
- [ ] `.env` の `ADMIN_TOKEN` / `POSTGRES_PASSWORD` が**推測不能なランダム値**
- [ ] `.env` が GitHub に上がっていない（`.gitignore` 済）
- [ ] HTTPS強制（certbotのリダイレクト有効）
- [ ] `db`/`redis`/`app` が `127.0.0.1` バインド（`docker compose ps` のPORTSで確認）
- [ ] `SEED_ON_START=false` に戻した
- [ ] バックアップcronが動く（翌日 `~/backup_*.sql` ができているか）

---

関連: [STATUS.md](STATUS.md)（現状・検証状況） / [AUDIT.md](AUDIT.md)（監査・コスト） / [ADS.md](ADS.md)（広告システム）
