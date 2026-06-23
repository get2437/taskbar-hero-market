import type { Metadata } from "next";
import { getMaterials } from "@/lib/materials";
import { getTranslator } from "@/lib/i18n/server";
import { MaterialsTable } from "@/components/materials-table";
import { AdBanner } from "@/components/ads";

// 静的データ(assets/materials.json)のみ。DB不要。
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("mat.title"), description: t("mat.sub") };
}

export default async function MaterialsPage() {
  const { t } = await getTranslator();
  const items = getMaterials();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("mat.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("mat.sub")}</p>
      </div>
      <AdBanner placement="materials_top" />
      <MaterialsTable items={items} />
      <AdBanner placement="materials_bottom" />
    </div>
  );
}
