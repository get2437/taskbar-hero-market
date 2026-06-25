"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * ページ閲覧の軽量計測。pathname が変わるたびに /api/track へ beacon を送る。
 * sendBeacon でページ遷移中でも確実に送信。失敗は無視(計測は best-effort)。
 */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({ path: pathname });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [pathname]);
  return null;
}
