# API仕様書

ベースURL: `/api`
全てJSON。価格は最小通貨単位の整数、変化率は bps (100 = 1.00%)。

認証: 本MVPは単一デモユーザーで動作 (`src/lib/session.ts`)。
管理APIのみ `x-admin-token` ヘッダで `ADMIN_TOKEN` を検証 (未設定時は許可)。

---

## アイテム

### `GET /api/items`
一覧 (検索・絞り込み・ソート・ページング)。

クエリパラメータ:

| 名前 | 型 | 説明 |
|---|---|---|
| `q` | string | アイテム名の部分一致 |
| `priceMin`,`priceMax` | int | 価格範囲 (最小通貨単位) |
| `types` | csv | `WEAPON,ARMOR,ACCESSORY,MATERIAL,CONSUMABLE` |
| `slots` | csv | `HEAD,BODY,ARM,LEG,WEAPON,ACCESSORY` |
| `grades` | csv | `COMMON,RARE,EPIC,LEGENDARY` |
| `classes` | csv | `WARRIOR,MAGE,ARCHER,ANY` |
| `levelMin`,`levelMax` | int | レベル範囲 |
| `sort` | enum | `price\|quantity\|level\|name\|score\|change7d` (既定 quantity) |
| `order` | enum | `asc\|desc` (既定 desc) |
| `page` | int | 1始まり |
| `pageSize` | int | 既定24 / 最大100 |

レスポンス:
```json
{
  "items": [{
    "id": "ck...", "name": "Blazing Sword (Lv12)", "marketHashName": "...",
    "imageUrl": null, "type": "WEAPON", "slot": "WEAPON", "grade": "EPIC",
    "classType": "WARRIOR", "level": 12,
    "lowestPrice": 12300, "medianPrice": 12500, "quantity": 42,
    "changePrev": 150, "change7d": -320, "change30d": 880,
    "investmentScore": 72, "recommendation": "A", "riskLevel": "GOOD", "trend": "UP",
    "fetchedAt": "2026-06-08T..."
  }],
  "total": 64, "page": 1, "pageSize": 24, "totalPages": 3
}
```

### `GET /api/items/{id}`
詳細 + 直近売買履歴 + お気に入り状態。
```json
{ "item": { ...Item, "latest": {...}, "analysis": {...}, "favoriteCount": {...} },
  "trades": [{ "price": 12300, "quantity": 3, "timestamp": "..." }],
  "favorited": false }
```

### `GET /api/items/{id}/history?range=`
価格推移。`range` = `24h|7d|30d|90d|all` (既定 30d)。
```json
{ "range": "30d", "points": [{ "t": 1733600000000, "price": 12300, "quantity": 5 }] }
```

---

## ダッシュボード / ランキング

### `GET /api/dashboard`
市場サマリ + 主要ランキング (Redis 30秒キャッシュ)。
```json
{
  "summary": { "marketCap": 0, "totalVolume": 0, "upCount": 0, "downCount": 0,
               "anomalyCount": 0, "itemCount": 64, "deadCount": 0 },
  "gainers": [...], "losers": [...], "volume": [...], "expensive": [...],
  "rare": [...], "buy": [...], "sell": [...]
}
```

### `GET /api/rankings/{kind}?limit=`
`kind` = `gainers|losers|volume|expensive|rare|buy|sell|favorites`。
```json
{ "kind": "buy", "items": [ /* ItemRow[] */ ] }
```

### `GET /api/anomalies`
未解決の異常検知一覧 (最大50)。
```json
{ "anomalies": [{
  "id": "...", "type": "SPIKE_UP", "window": "H24", "changeBps": 2500,
  "detectedAt": "...", "item": { "id": "...", "name": "...", "imageUrl": null, "lowestPrice": 12300 }
}] }
```

---

## お気に入り

### `GET /api/favorites?folderId=&sort=`
`sort` = `created|price|change|score`。損益シミュレーション付き。
```json
{ "favorites": [{
  "favoriteId": "...", "id": "...", "name": "...", "lowestPrice": 12300,
  "folderId": null, "memo": "100円以下で購入", "purchasePrice": 10000,
  "profit": 2300, "profitAfterFee": 455, "profitRate": 2300
}] }
```

### `POST /api/favorites`
登録/解除トグル。 body: `{ "itemId": "..." }` → `{ "favorited": true }`

### `PATCH /api/favorites/{id}`
メモ・フォルダ・購入価格の更新。 body: `{ "memo": "...", "folderId": "...", "purchasePrice": 10000 }`

### `DELETE /api/favorites/{id}`
お気に入り削除。

---

## フォルダ

### `GET /api/folders`
`{ "folders": [{ "id", "name", "color", "count" }] }`

### `POST /api/folders`
body: `{ "name": "買いたい", "color": "#22c55e" }`

---

## 通知 / アラート

### `GET /api/alerts` / `POST /api/alerts`
作成 body:
```json
{ "itemId": "...", "condition": "PRICE_BELOW", "threshold": 10000, "channel": "WEB" }
```
`condition` = `PRICE_BELOW|PRICE_ABOVE|CHANGE_UP|CHANGE_DOWN|SPIKE_UP|SPIKE_DOWN|VOLUME_SPIKE`
`channel` = `WEB|DISCORD|EMAIL`。価格系は最小通貨単位、変動系は bps。

### `PATCH /api/alerts/{id}` / `DELETE /api/alerts/{id}`
有効/無効切替・しきい値変更・削除。

### `GET /api/notifications` / `POST /api/notifications`
GET: `{ "notifications": [...], "unread": 3 }`
POST: 既読化。body `{ "id": "..." }` で個別、空で全件既読。

---

## 管理 (要 `x-admin-token`)

### `POST /api/admin/refresh?fetch=true|false`
取得 → 分析 → 通知判定。`fetch=false` で取得をスキップし再分析のみ。
```json
{ "fetched": 0, "analyzed": 64, "anomalies": 5, "notified": 1, "skippedFetch": true, "message": "..." }
```

### `DELETE /api/admin/cache`
Redisキャッシュ削除。 `{ "ok": true, "removed": 12 }`

### `GET /api/admin/status`
件数・最終更新・ジョブログ。
```json
{ "counts": { "itemCount": 64, "snapshotCount": 5760, "historyCount": 5760, "anomalyCount": 5 },
  "lastUpdated": "...", "logs": [ /* FetchLog[] */ ] }
```

---

## エラー

| コード | 意味 |
|---|---|
| 400 | バリデーションエラー (Zod) |
| 401 | 管理トークン不正 |
| 404 | リソースなし |
| 500 | サーバエラー |

エラー形式: `{ "error": "メッセージ" }`
