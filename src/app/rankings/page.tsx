import { Suspense } from "react";
import type { Metadata } from "next";
import { RankingsView } from "@/components/rankings-view";
import { getTranslator } from "@/lib/i18n/server";
import { AdBanner } from "@/components/ads";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("rank.title"), description: t("rank.sub") };
}

export default async function RankingsPage() {
  const { t } = await getTranslator();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("rank.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rank.sub")}</p>
      </div>
      {/* 広告: ページ上部 */}
      <AdBanner placement="rankings_top" />
      <Suspense fallback={<div className="text-sm text-muted-foreground">{t("common.loading")}</div>}>
        <RankingsView />
      </Suspense>
      {/* 広告: ページ下部 */}
      <AdBanner placement="rankings_bottom" />
    </div>
  );
}
