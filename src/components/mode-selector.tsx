"use client";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/mode/provider";
import { useT } from "@/lib/i18n/provider";
import { MODE_COOKIE, type Mode } from "@/lib/mode";
import { cn } from "@/lib/utils";

/** 購入/販売モードのトグル (topbar)。cookie保存 + router.refresh で全画面に反映。 */
export function ModeSelector() {
  const router = useRouter();
  const mode = useMode();
  const { t } = useT();

  function set(m: Mode) {
    if (m === mode) return;
    document.cookie = `${MODE_COOKIE}=${m}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="inline-flex overflow-hidden rounded-lg border" role="group" aria-label="Buy / Sell mode">
      <button
        onClick={() => set("buy")}
        aria-pressed={mode === "buy"}
        className={cn("px-3 py-1.5 text-sm font-bold transition-colors", mode === "buy" ? "bg-up/20 text-up" : "text-muted-foreground hover:bg-accent")}
      >
        {t("mode.buy")}
      </button>
      <button
        onClick={() => set("sell")}
        aria-pressed={mode === "sell"}
        className={cn("px-3 py-1.5 text-sm font-bold transition-colors", mode === "sell" ? "bg-down/20 text-down" : "text-muted-foreground hover:bg-accent")}
      >
        {t("mode.sell")}
      </button>
    </div>
  );
}
