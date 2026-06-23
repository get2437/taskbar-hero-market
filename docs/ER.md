# ER図

価格は全て **最小通貨単位の整数**、変化率は **basis points (bps)** で保持する。

```mermaid
erDiagram
    Item ||--o| ItemLatest : "最新スナップショット"
    Item ||--o| ItemAnalysis : "分析結果"
    Item ||--o| FavoriteStat : "登録数集計"
    Item ||--o{ MarketSnapshot : "時系列スナップショット"
    Item ||--o{ PriceHistory : "売買履歴"
    Item ||--o{ Anomaly : "異常検知"
    Item ||--o{ Favorite : ""
    Item ||--o{ PriceAlert : ""

    User ||--o{ Favorite : ""
    User ||--o{ Folder : ""
    User ||--o{ PriceAlert : ""
    User ||--o{ Notification : ""
    Folder ||--o{ Favorite : "分類"
    PriceAlert ||--o{ Notification : "発火"

    Item {
        string   id PK
        int      appId
        string   marketHashName UK
        string   name
        string   imageUrl
        enum     type "WEAPON/ARMOR/ACCESSORY/MATERIAL/CONSUMABLE/UNKNOWN"
        enum     slot "HEAD/BODY/ARM/LEG/WEAPON/ACCESSORY/UNKNOWN"
        enum     grade "COMMON/RARE/EPIC/LEGENDARY"
        enum     classType "WARRIOR/MAGE/ARCHER/ANY"
        int      level
        bool     active
        datetime createdAt
        datetime updatedAt
    }

    ItemLatest {
        string   itemId PK,FK
        int      lowestPrice
        int      highestPrice
        int      medianPrice
        int      averagePrice
        int      quantity
        int      changePrev "bps"
        int      change7d "bps"
        int      change30d "bps"
        datetime fetchedAt
    }

    MarketSnapshot {
        string   id PK
        string   itemId FK
        int      lowestPrice
        int      highestPrice
        int      medianPrice
        int      averagePrice
        int      quantity
        datetime createdAt
    }

    PriceHistory {
        string   id PK
        string   itemId FK
        int      price
        int      quantity
        datetime timestamp "UK(itemId,timestamp)"
    }

    ItemAnalysis {
        string   itemId PK,FK
        int      ma7
        int      ma30
        int      ma90
        int      volatility "bps"
        int      fairPrice
        int      undervaluedRate "bps"
        int      overvaluedRate "bps"
        enum     trend "UP/DOWN/FLAT"
        int      investmentScore "0-100"
        enum     riskLevel "DANGER/CAUTION/GOOD/PROMISING"
        enum     recommendation "S/A/B/C"
        int      scorePrice
        int      scoreVolume
        int      scoreStability
        int      scoreVolatility
        int      scorePopularity
        int      forecast7
        int      forecast30
        int      forecast90
        int      forecastLow
        int      forecastHigh
        int      forecastConf "0-100"
        string   aiComment
        datetime updatedAt
    }

    Anomaly {
        string   id PK
        string   itemId FK
        enum     type "SPIKE_UP/SPIKE_DOWN/VOLUME_SPIKE/VOLUME_DROP"
        enum     window "H1/H24/D7/D30/D90"
        int      changeBps
        datetime detectedAt
        bool     resolved
    }

    User {
        string   id PK
        string   email UK
        string   name
        datetime createdAt
    }

    Folder {
        string   id PK
        string   userId FK
        string   name
        string   color
        int      sortOrder
    }

    Favorite {
        string   id PK
        string   userId FK
        string   itemId FK
        string   folderId FK
        string   memo
        int      purchasePrice
        datetime createdAt
    }

    FavoriteStat {
        string   itemId PK,FK
        int      total
        int      last24h
        datetime updatedAt
    }

    PriceAlert {
        string   id PK
        string   userId FK
        string   itemId FK
        enum     condition "PRICE_BELOW/PRICE_ABOVE/CHANGE_UP/CHANGE_DOWN/SPIKE_UP/SPIKE_DOWN/VOLUME_SPIKE"
        int      threshold "価格 or bps"
        enum     channel "WEB/DISCORD/EMAIL"
        bool     enabled
        datetime lastTriggered
    }

    Notification {
        string   id PK
        string   userId FK
        string   alertId FK
        string   title
        string   body
        enum     channel
        bool     read
        datetime createdAt
    }

    FetchLog {
        string   id PK
        string   kind
        enum     status "RUNNING/SUCCESS/FAILED"
        int      itemsTotal
        int      itemsOk
        int      itemsFailed
        string   message
        datetime startedAt
        datetime finishedAt
    }
```

## 設計上のポイント

- `ItemLatest` / `ItemAnalysis` / `FavoriteStat` は `Item` と 1:1 の非正規化テーブル。
  一覧・ソート・検索を高速化するため、毎回集計せず最新値をここに持つ (一覧表示1秒以内の要件)。
- `MarketSnapshot` は15分毎の集計の時系列、`PriceHistory` は約定単位の時系列。
- 時系列クエリ向けに `(itemId, timestamp)` などの複合インデックスを付与。
- 通貨・割合の単位を整数に統一し、表示層 (`formatPrice` / `formatBps`) でのみ換算する。
