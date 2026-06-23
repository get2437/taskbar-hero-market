"use client";
import { useState } from "react";
import { useLive } from "@/lib/use-live";
import { cn } from "@/lib/utils";

/** 接続状態 + 最終更新を表示する小さなライブインジケータ (topbar用)。 */
export function LiveIndicator() {
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const { connected } = useLive((ev) => {
    if (ev?.type === "market" || ev?.type === "orderbook") setLastUpdated(Date.now());
  });

  return (
    <span className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs sm:inline-flex" title={lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : ""}>
      <span className={cn("h-2 w-2 rounded-full", connected ? "animate-pulse bg-up" : "bg-muted-foreground")} />
      <span className={connected ? "text-up" : "text-muted-foreground"}>{connected ? "LIVE" : "..."}</span>
    </span>
  );
}
