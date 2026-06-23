"use client";
import { AdUnit } from "./ad-unit";
import type { Placement } from "@/lib/ads/config";
import { cn } from "@/lib/utils";

/**
 * 用途別の広告コンポーネント（レスポンシブ最適化込み）。
 * ページ側はこれらを置くだけ。AdSenseのコードや slot ID は触らない。
 */

/** 横長バナー（ページ上下）。PC/タブレット/スマホで自動レスポンシブ。 */
export function AdBanner({ placement, className }: { placement: Placement; className?: string }) {
  return <AdUnit placement={placement} responsive className={cn("my-4", className)} />;
}

/** サイドバー矩形（PCのみ表示）。スマホ/タブレットでは非表示。 */
export function AdSidebar({ placement = "sidebar", className }: { placement?: Placement; className?: string }) {
  return <AdUnit placement={placement} responsive className={cn("hidden lg:block", className)} />;
}

/** 記事内/コンテンツの間に挿入する広告。全デバイス表示・中央寄せ。 */
export function AdInContent({ placement, className }: { placement: Placement; className?: string }) {
  return <AdUnit placement={placement} responsive className={cn("mx-auto my-4 max-w-3xl", className)} />;
}

/** モバイル専用（PC/タブレットでは非表示）。 */
export function AdMobile({ placement = "mobile_anchor", className }: { placement?: Placement; className?: string }) {
  return <AdUnit placement={placement} responsive className={cn("block md:hidden", className)} />;
}

export { AdUnit };
