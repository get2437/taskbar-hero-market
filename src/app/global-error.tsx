"use client";
import { useEffect, useState } from "react";

// プロバイダ外で描画されるため、i18n は cookie から最小辞書で対応する。
const MSG: Record<string, { err: string; retry: string }> = {
  en: { err: "Something went wrong.", retry: "Try again" },
  ja: { err: "問題が発生しました。", retry: "再試行" },
  ko: { err: "문제가 발생했습니다.", retry: "다시 시도" },
  zh: { err: "出现错误。", retry: "重试" },
  ru: { err: "Что-то пошло не так.", retry: "Повторить" },
  pt: { err: "Algo deu errado.", retry: "Tentar novamente" },
  es: { err: "Algo salió mal.", retry: "Reintentar" },
  fr: { err: "Une erreur est survenue.", retry: "Réessayer" },
  de: { err: "Etwas ist schiefgelaufen.", retry: "Erneut versuchen" },
};

// ルートレイアウト自体が失敗した場合のフォールバック (html/body を自前で持つ)
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [loc, setLoc] = useState("en");
  useEffect(() => {
    const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )locale=([^;]+)/) : null;
    const l = m?.[1];
    if (l && MSG[l]) setLoc(l);
  }, []);
  const c = MSG[loc] ?? MSG.en;

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
    <html lang={loc}>
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1120", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#ef444466" }}>500</div>
          <p style={{ color: "#94a3b8" }}>{c.err}</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            {c.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
