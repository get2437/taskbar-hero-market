/**
 * 広告設定の一元管理。
 * - ページに広告コードを直接埋め込まず、こことコンポーネントだけで完結させる。
 * - ON/OFF は環境変数で切替（NEXT_PUBLIC_ADS_ENABLED）。
 * - 現状 Google AdSense。将来の他ネットワークは AdNetwork を増やして AdUnit 側で分岐。
 *
 * NEXT_PUBLIC_* はビルド時にインライン化されるため、各 env は静的に参照する。
 */

export type AdNetwork = "adsense";
export type AdFormat = "banner" | "rectangle" | "sidebar" | "in-content" | "mobile";

export type Placement =
  | "home_top"
  | "home_bottom"
  | "items_top"
  | "items_bottom"
  | "detail_chart"
  | "detail_related"
  | "rankings_top"
  | "rankings_bottom"
  | "gear_top"
  | "gear_bottom"
  | "materials_top"
  | "materials_bottom"
  | "sidebar"
  | "mobile_anchor";

// マスタースイッチ + ネットワーク設定
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
export const AD_NETWORK: AdNetwork = "adsense";
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
// 開発時に枠位置を確認するためのプレースホルダ表示
export const ADS_PLACEHOLDER = process.env.NEXT_PUBLIC_ADS_PLACEHOLDER === "true";

// 配置 -> AdSense 広告ユニットID (未設定は default にフォールバック)
const DEFAULT_SLOT = process.env.NEXT_PUBLIC_AD_SLOT_DEFAULT ?? "";
const SLOTS: Record<Placement, string> = {
  home_top: process.env.NEXT_PUBLIC_AD_SLOT_HOME_TOP || DEFAULT_SLOT,
  home_bottom: process.env.NEXT_PUBLIC_AD_SLOT_HOME_BOTTOM || DEFAULT_SLOT,
  items_top: process.env.NEXT_PUBLIC_AD_SLOT_ITEMS_TOP || DEFAULT_SLOT,
  items_bottom: process.env.NEXT_PUBLIC_AD_SLOT_ITEMS_BOTTOM || DEFAULT_SLOT,
  detail_chart: process.env.NEXT_PUBLIC_AD_SLOT_DETAIL_CHART || DEFAULT_SLOT,
  detail_related: process.env.NEXT_PUBLIC_AD_SLOT_DETAIL_RELATED || DEFAULT_SLOT,
  rankings_top: process.env.NEXT_PUBLIC_AD_SLOT_RANKINGS_TOP || DEFAULT_SLOT,
  rankings_bottom: process.env.NEXT_PUBLIC_AD_SLOT_RANKINGS_BOTTOM || DEFAULT_SLOT,
  gear_top: process.env.NEXT_PUBLIC_AD_SLOT_GEAR_TOP || DEFAULT_SLOT,
  gear_bottom: process.env.NEXT_PUBLIC_AD_SLOT_GEAR_BOTTOM || DEFAULT_SLOT,
  materials_top: process.env.NEXT_PUBLIC_AD_SLOT_MATERIALS_TOP || DEFAULT_SLOT,
  materials_bottom: process.env.NEXT_PUBLIC_AD_SLOT_MATERIALS_BOTTOM || DEFAULT_SLOT,
  sidebar: process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR || DEFAULT_SLOT,
  mobile_anchor: process.env.NEXT_PUBLIC_AD_SLOT_MOBILE || DEFAULT_SLOT,
};

// 配置ごとの形状（CLS対策の予約高さ込み）
const FORMAT: Record<Placement, AdFormat> = {
  home_top: "banner",
  home_bottom: "banner",
  items_top: "banner",
  items_bottom: "banner",
  detail_chart: "in-content",
  detail_related: "in-content",
  rankings_top: "banner",
  rankings_bottom: "banner",
  gear_top: "banner",
  gear_bottom: "banner",
  materials_top: "banner",
  materials_bottom: "banner",
  sidebar: "sidebar",
  mobile_anchor: "mobile",
};

// CLSを防ぐための予約最小高さ(px)。レスポンシブでも崩れにくい控えめ値。
export const MIN_HEIGHT: Record<AdFormat, number> = {
  banner: 100,
  rectangle: 250,
  sidebar: 600,
  "in-content": 280,
  mobile: 100,
};

export function slotFor(p: Placement): string {
  return SLOTS[p];
}
export function formatFor(p: Placement): AdFormat {
  return FORMAT[p];
}

/** その配置の広告を表示してよいか（master switch + client + slot が揃う、または開発プレースホルダ）。 */
export function canShow(p: Placement): boolean {
  if (ADS_PLACEHOLDER) return true;
  return ADS_ENABLED && !!ADSENSE_CLIENT && !!SLOTS[p];
}
