"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => {
    console.error("[error-boundary]", error);
    // サーバ経由で監視へ報告 (DSN/Webhook はサーバ側で送信)。失敗は無視。
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        source: "error-boundary",
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-5xl font-black text-destructive/40">500</div>
      <p className="text-muted-foreground">{t("common.error")}</p>
      {error.digest && <p className="text-xs text-muted-foreground/60">ref: {error.digest}</p>}
      <div className="flex gap-2">
        <Button onClick={() => reset()}>{t("common.retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/">{t("common.home")}</Link>
        </Button>
      </div>
    </div>
  );
}
