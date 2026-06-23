import { Suspense } from "react";
import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites-view";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.favorites"), description: t("fav.sub") };
}

export default async function FavoritesPage() {
  const { t } = await getTranslator();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("nav.favorites")}</h1>
        <p className="text-sm text-muted-foreground">{t("fav.sub")}</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">{t("common.loading")}</div>}>
        <FavoritesView />
      </Suspense>
    </div>
  );
}
