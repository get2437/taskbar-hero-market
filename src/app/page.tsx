import { Suspense } from "react";
import type { Metadata } from "next";
import { ItemsBrowser } from "@/components/items-browser";
import { getTranslator } from "@/lib/i18n/server";
import { getLastUpdated } from "@/lib/queries";
import { AdBanner } from "@/components/ads";
import { LiveRefresh } from "@/components/live-refresh";
import { safeJsonLd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("items.title"), description: t("items.sub") };
}

// ホーム = アイテム一覧
export default async function HomePage() {
  const { t } = await getTranslator();
  const lastUpdated = await getLastUpdated();
  const updatedText = lastUpdated
    ? lastUpdated.toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : t("market.noData");

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Taskbar Hero Market Analytics",
    description: "Stock-style analytics for the Steam Community Market of Taskbar Hero.",
    ...(site ? { url: site } : {}),
  };

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(siteLd) }} />
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-bold">{t("items.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("items.sub")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          🔄 {t("market.updated")}: <span className="tabular">{updatedText}</span>
          <span className="opacity-70"> · {t("market.autoUpdate")}</span>
        </p>
      </div>
      {/* 広告: 一覧上部 */}
      <AdBanner placement="items_top" />
      <Suspense fallback={<div className="text-sm text-muted-foreground">{t("common.loading")}</div>}>
        <ItemsBrowser />
      </Suspense>
      {/* 広告: 一覧下部 */}
      <AdBanner placement="items_bottom" />
    </div>
  );
}
