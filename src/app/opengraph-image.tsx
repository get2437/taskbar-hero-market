import { ImageResponse } from "next/og";
import { ogFallback } from "@/lib/og-fallback";

// サイト共通の共有プレビュー画像 (ホーム等・DB不要)
export const runtime = "nodejs";
// ビルド時の静的プリレンダ(リクエスト文脈なし)を避け、リクエスト時に生成する
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Taskbar Hero Market Analytics";

export default function Image() {
  try {
  const host = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: "linear-gradient(135deg,#0b1120 0%,#0a0f1c 55%,#020617 100%)",
          color: "#e2e8f0", fontFamily: "sans-serif", padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700, color: "#60a5fa" }}>
          <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: "#22c55e" }} />
          Taskbar Hero · Market Analytics
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
            Steam Market, like a stock chart.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#94a3b8" }}>
            Prices · rankings · anomalies · order book · investment scores
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            {["Buy / Sell", "Live order book", "Price alerts", "9 languages · 7 currencies"].map((t) => (
              <span key={t} style={{ display: "flex", fontSize: 22, color: "#cbd5e1", border: "2px solid #334155", borderRadius: 10, padding: "6px 16px" }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#64748b" }}>
          <span>Steam Community Market analytics for Taskbar Hero</span>
          <span>{host}</span>
        </div>
      </div>
    ),
    { ...size },
  );
  } catch {
    return ogFallback();
  }
}
