"use client";
import { useEffect, useRef } from "react";
import type { Placement } from "./config";

/**
 * 広告アナリティクス。
 *
 * 注意: AdSense の実クリックはクロスオリジンiframe内で発生するため、
 * サイト側からクリック自体を直接取得することはできない（規約上も計測コードの改変は不可）。
 * そのため計測可能なのは「インプレッション(枠が表示された)」と「ビューアビリティ(50%可視)」。
 * クリック相当はAdSense管理画面のレポートで確認する。
 *
 * ここでは枠の表示/可視を汎用イベントとして送出し、gtag / dataLayer / 独自エンドポイントに
 * 差し替え可能にしておく（将来の他ネットワークやクリック計測対応の受け皿）。
 */
type AdEvent = "ad_render" | "ad_impression";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function trackAdEvent(event: AdEvent, data: { placement: Placement; network: string }) {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, { ad_placement: data.placement, ad_network: data.network });
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event, ...data });
    }
    // 開発時の可視化
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ad]", event, data.placement);
    }
  } catch {
    /* 計測失敗は無視 */
  }
}

/** 枠が50%可視になったら一度だけ ad_impression を送る。CLS/性能に影響しない受動計測。 */
export function useAdImpression(placement: Placement, network: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !fired.current) {
            fired.current = true;
            trackAdEvent("ad_impression", { placement, network });
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [placement, network]);
  return ref;
}
