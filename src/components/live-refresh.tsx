"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/lib/use-live";

/**
 * market イベント受信時にサーバコンポーネントを再取得 (router.refresh)。
 * 連続発火を抑えるため最短間隔を設ける。ダッシュボード等に1つ置く。
 */
export function LiveRefresh({ minIntervalMs = 5000 }: { minIntervalMs?: number }) {
  const router = useRouter();
  const last = useRef(0);
  useLive((ev) => {
    if (ev?.type !== "market") return;
    const now = Date.now();
    if (now - last.current < minIntervalMs) return;
    last.current = now;
    router.refresh();
  });
  return null;
}
