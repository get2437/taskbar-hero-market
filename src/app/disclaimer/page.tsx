import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Disclaimer", robots: { index: true, follow: true } };

// ⚠️ 公開前に内容を確認・調整してください（雛形）。
const JA = {
  title: "免責事項",
  updated: "最終更新: 2026-06-16",
  body: [
    ["投資助言ではありません", "当サイトの価格・投資スコア・予測・分析コメントは情報提供のみを目的とし、投資助言ではありません。これらはヒューリスティックな推定値であり、将来の価格や利益を保証するものではありません。売買の判断はご自身の責任で行ってください。"],
    ["データの正確性", "マーケットデータは Steam から取得しており、遅延・欠落・誤りが含まれる可能性があります。当サイトはデータの正確性・完全性・可用性を保証しません。"],
    ["免責", "当サイトの利用によって生じたいかなる損害についても、当サイトは責任を負いません。ご利用は自己責任でお願いします。"],
    ["商標", "当サイトは非公式ツールであり、Valve Corporation との提携・公認はありません。Steam および Steam ロゴは Valve の商標です。ゲーム名・アイテム名は各権利者に帰属します。"],
    ["Steam の規約", "Steam マーケットでの実際の取引は、Steam（Valve）自身の利用規約に従います。"],
  ],
};

const EN = {
  title: "Disclaimer",
  updated: "Last updated: 2026-06-16",
  body: [
    ["Not financial advice", "Prices, investment scores, forecasts and analysis on this Site are for informational purposes only and are not financial or investment advice. They are heuristic estimates and do not guarantee future prices or profits. Any trading decisions are made at your own risk."],
    ["Accuracy of data", "Market data is sourced from Steam and may be delayed, incomplete, or inaccurate. We make no warranty as to the accuracy, completeness, or availability of the data."],
    ["Limitation of liability", "We are not liable for any losses or damages arising from use of this Site. Use at your own risk."],
    ["Trademarks", "This is an unofficial tool, not affiliated with or endorsed by Valve Corporation. Steam and the Steam logo are trademarks of Valve. Game and item names belong to their respective owners."],
    ["Steam terms", "Actual trading on the Steam Market is governed by Steam’s (Valve’s) own terms of service."],
  ],
};

export default async function DisclaimerPage() {
  const locale = await getLocale();
  const c = locale === "ja" ? JA : EN;
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="text-xs text-muted-foreground">{c.updated}</p>
      </div>
      {c.body.map(([h, p]) => (
        <section key={h} className="space-y-1">
          <h2 className="text-base font-semibold">{h}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{p}</p>
        </section>
      ))}
    </article>
  );
}
