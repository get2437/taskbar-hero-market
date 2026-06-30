import type { Metadata } from "next";
import { getGearTable } from "@/lib/queries";
import { getTranslator } from "@/lib/i18n/server";
import { GearTable } from "@/components/gear-table";
import { LiveRefresh } from "@/components/live-refresh";
import { AdBanner } from "@/components/ads";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return { title: t("gear.title"), description: t("gear.sub"), ...(site ? { alternates: { canonical: `${site}/gear` } } : {}) };
}

export default async function GearPage() {
  const { t } = await getTranslator();
  const items = await getGearTable();
  return (
    <div className="space-y-4">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-bold">{t("gear.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("gear.sub")}</p>
      </div>
      <AdBanner placement="gear_top" />
      <GearTable items={items} />
      <AdBanner placement="gear_bottom" />
    </div>
  );
}
