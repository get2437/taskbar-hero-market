"use client";
import { useEffect } from "react";

// ルートレイアウト自体が失敗した場合のフォールバック (html/body を自前で持つ)
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        source: "global-error",
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1120", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#ef444466" }}>500</div>
          <p style={{ color: "#94a3b8" }}>Something went wrong. / 問題が発生しました。</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again / 再試行
          </button>
        </div>
      </body>
    </html>
  );
}
