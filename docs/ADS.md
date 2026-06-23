# 広告システム

収益化を見据えた一元管理。**ページに広告コードを直接書かない**。配置(`placement`)を指定するだけ。

## 構成
```
src/lib/ads/config.ts      … 一元設定 (ON/OFF・ネットワーク・配置別slot・形状・CLS高さ)
src/lib/ads/analytics.ts   … 計測 (ad_render / ad_impression、gtag/dataLayer連携)
src/components/ads/ad-unit.tsx … 基盤 (CLS予約・遅延読込・計測・AdSense ins出力)
src/components/ads/index.tsx   … AdBanner / AdSidebar / AdInContent / AdMobile
```

## コンポーネント
| 名前 | 用途 | レスポンシブ |
|---|---|---|
| `AdBanner` | 横長バナー（ページ上下） | 全デバイス |
| `AdSidebar` | サイドバー矩形 | **PCのみ** (`hidden lg:block`) |
| `AdInContent` | 記事内/コンテンツ間 | 全デバイス・中央寄せ |
| `AdMobile` | モバイル専用 | **スマホのみ** (`block md:hidden`) |

使用例: `<AdBanner placement="home_top" />`

## 配置(placement)
| ページ | placement |
|---|---|
| ホーム | `home_top`(ファーストビュー下) / `home_bottom`(フッター上) |
| アイテム一覧 | `items_top` / `items_bottom` |
| アイテム詳細 | `detail_chart`(グラフ下) / `detail_related`(関連アイテム上) |
| ランキング | `rankings_top` / `rankings_bottom` |
| 汎用 | `sidebar` / `mobile_anchor` |

## ON/OFF・設定 (環境変数)
- `NEXT_PUBLIC_ADS_ENABLED=true` … マスタースイッチ（false/未設定なら全非表示）
- `NEXT_PUBLIC_ADS_PLACEHOLDER=true` … 開発時に枠位置だけ確認（実広告は出ない）
- `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-xxxx`
- `NEXT_PUBLIC_AD_SLOT_<PLACEMENT>` … 配置別の広告ユニットID（未設定は `NEXT_PUBLIC_AD_SLOT_DEFAULT` にフォールバック）

→ 広告を出すには **ADS_ENABLED=true かつ client かつ その配置のslot** が必要。AdSenseスクリプトも `ADS_ENABLED && client` の時だけ読み込む。

## Core Web Vitals 対策
- **CLS**: 配置ごとに**予約 min-height**（banner 100 / in-content 280 / sidebar 600 …）を確保し、広告ロードでレイアウトがずれない。
- **LCP/性能**: AdSense本体は `afterInteractive` で非ブロッキング読込。各枠は**ビューポート手前200pxで初めて push**（遅延読込）し、初期描画と帯域を圧迫しない。
- ファーストビュー直上には大型広告を置かない（`home_top`は要約の下）。

## Analytics（クリック分析の設計）
- 送出イベント: `ad_render`（枠描画）/ `ad_impression`（50%可視, IntersectionObserver）。`window.gtag` か `dataLayer` があれば自動送信、無ければ no-op。
- **注意**: AdSenseの実クリックはクロスオリジンiframe内で発生し**サイト側から取得不可**（規約上もコード改変不可）。クリック相当はAdSense管理画面のレポートで確認。サイト側で取れるのは表示/可視まで。将来クリック計測対応のネットワークを足す場合は `analytics.ts` の `trackAdEvent` を差し替え。

## 将来の他ネットワーク追加
`config.ts` の `AdNetwork` を増やし、`ad-unit.tsx` で `AD_NETWORK` により出力を分岐するだけ。ページ/配置のコードは変更不要。
