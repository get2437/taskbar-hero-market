import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getRates } from "@/lib/fx";
import { formatMoney } from "@/lib/money";
import { ogFallback } from "@/lib/og-fallback";

// SNS/Discord 共有時のプレビュー画像 (アイテム別・動的生成)
export const runtime = "nodejs";
export const revalidate = 900; // 15分キャッシュ (データ更新間隔に合わせる)
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Taskbar Hero Market — item price & analysis";

const GRADE_COLOR: Record<string, string> = {
  COMMON: "#94a3b8", UNCOMMON: "#4ade80", RARE: "#60a5fa", LEGENDARY: "#fbbf24",
  ARCANA: "#c084fc", IMMORTAL: "#f87171", BEYOND: "#22d3ee", DIVINE: "#f472b6",
  CELESTIAL: "#2dd4bf", COSMIC: "#e879f9",
};
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params;
  const item = await prisma.item
    .findUnique({ where: { id }, include: { latest: true } })
    .catch(() => null);

  const name = item?.name ?? "Taskbar Hero Market";
  const grade = item?.grade ?? "COMMON";
  const gradeColor = GRADE_COLOR[grade] ?? "#94a3b8";
  const isGear = item?.type === "GEAR";
  // 共有画像は閲覧者のcookieに依存しないため、英語OGに合わせ通貨は USD 固定(為替換算)。
  const rates = await getRates();
  const price = formatMoney(item?.latest?.lowestPrice ?? null, "USD", rates);
  const changeBps = item?.latest?.changePrev ?? 0;
  const up = changeBps > 0;
  const changePct = Math.abs(changeBps / 100).toFixed(1);
  const icon = item?.imageUrl ? `${item.imageUrl}/360fx360f` : null;
  const host = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg,#0b1120 0%,#0a0f1c 55%,#020617 100%)",
          color: "#e2e8f0", fontFamily: "sans-serif", padding: 64,
        }}
      >
        {/* ブランド */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700, color: "#60a5fa" }}>
          <div style={{ display: "flex", width: 16, height: 16, borderRadius: 8, background: "#22c55e" }} />
          Taskbar Hero · Market Analytics
        </div>

        {/* 本体 */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48, marginTop: 20 }}>
          {icon && (
            <div
              style={{
                display: "flex", width: 300, height: 300, borderRadius: 24, background: "#111827",
                border: "1px solid #1f2937", alignItems: "center", justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon} width={262} height={262} style={{ objectFit: "contain" }} alt="" />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.05, color: "#ffffff" }}>{name}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: gradeColor, border: `2px solid ${gradeColor}`, borderRadius: 10, padding: "4px 16px" }}>{cap(grade)}</span>
              {isGear && item?.classType && item.classType !== "NONE" && (
                <span style={{ fontSize: 24, color: "#cbd5e1", border: "2px solid #334155", borderRadius: 10, padding: "4px 16px" }}>{cap(item.classType)}</span>
              )}
              {isGear && item?.level != null && (
                <span style={{ fontSize: 24, color: "#cbd5e1", border: "2px solid #334155", borderRadius: 10, padding: "4px 16px" }}>Lv{item.level}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 22, marginTop: 38 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, color: "#94a3b8" }}>Lowest price</span>
                <span style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>{price}</span>
              </div>
              {changeBps !== 0 && (
                <span style={{ display: "flex", fontSize: 34, fontWeight: 700, color: up ? "#34d399" : "#f87171", marginBottom: 10 }}>
                  {up ? "▲" : "▼"} {changePct}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#64748b" }}>
          <span>Steam Community Market · live order book &amp; analysis</span>
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
