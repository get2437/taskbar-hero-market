"use client";
import { useEffect, useRef, useState } from "react";
import {
  canShow, slotFor, formatFor, MIN_HEIGHT,
  ADSENSE_CLIENT, ADS_ENABLED, ADS_PLACEHOLDER, AD_NETWORK, type Placement,
} from "@/lib/ads/config";
import { trackAdEvent } from "@/lib/ads/analytics";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 広告枠の基盤。配置(placement)だけ渡せば設定はすべて config から解決。
 * - CLS対策: 予約 min-height
 * - 性能対策: ビューポート手前(200px)に来てから初めて adsbygoogle を push（遅延読込）
 * - 計測: 描画(ad_render) / 50%可視(ad_impression)
 */
export function AdUnit({ placement, className, responsive = true }: { placement: Placement; className?: string; responsive?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const pushed = useRef(false);
  const impressed = useRef(false);
  const minH = MIN_HEIGHT[formatFor(placement)];

  // 遅延読込: 手前に来たら表示
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (setInView(true), io.disconnect())),
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // adsbygoogle push + ad_render
  useEffect(() => {
    if (!inView || pushed.current || ADS_PLACEHOLDER || !ADS_ENABLED || !ADSENSE_CLIENT) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      trackAdEvent("ad_render", { placement, network: AD_NETWORK });
    } catch {
      /* ignore */
    }
  }, [inView, placement]);

  // 50%可視で ad_impression
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (e.isIntersecting && !impressed.current) {
          impressed.current = true;
          trackAdEvent("ad_impression", { placement, network: AD_NETWORK });
          io.disconnect();
        }
      }),
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [placement]);

  if (!canShow(placement)) return null;

  return (
    <div
      ref={ref}
      data-ad-placement={placement}
      aria-label="Advertisement"
      className={cn("relative w-full overflow-hidden rounded-lg", className)}
      style={{ minHeight: minH }}
    >
      <span className="pointer-events-none absolute left-1 top-0 z-10 text-[9px] uppercase tracking-wide text-muted-foreground/50">
        Ad
      </span>
      {ADS_PLACEHOLDER ? (
        <div className="flex w-full items-center justify-center border border-dashed text-xs text-muted-foreground" style={{ minHeight: minH }}>
          Ad · {placement}
        </div>
      ) : inView ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block", minHeight: minH }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slotFor(placement)}
          data-ad-format={responsive ? "auto" : undefined}
          data-full-width-responsive={responsive ? "true" : undefined}
        />
      ) : null}
    </div>
  );
}
