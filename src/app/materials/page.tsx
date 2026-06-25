import type { Metadata } from "next";
import { getMaterials } from "@/lib/materials";
import { getTranslator } from "@/lib/i18n/server";
import { MaterialsTable } from "@/components/materials-table";
import { AdBanner } from "@/components/ads";
import { prisma } from "@/lib/prisma";

// データは静的(assets/materials.json)でDB不要だが、レイアウトが cookie(通貨/言語)を読むため
// dynamic にする。static にすると cookie を読まず通貨/言語が常に既定になる(他ページと不一致)。
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("mat.title"), description: t("mat.sub") };
}

export default async function MaterialsPage() {
  const { t } = await getTranslator();
  const items = getMaterials();

  // 素材 → DBアイテムidの対応付け (出品中の素材は詳細ページへ飛べるように)。
  // 素材の market_hash_name は名前と一致するため name / marketHashName 両方で照合する。
  const names = items.map((m) => m.name);
  const dbItems = await prisma.item
    .findMany({
      where: { OR: [{ name: { in: names } }, { marketHashName: { in: names } }] },
      select: { id: true, name: true, marketHashName: true },
    })
    .catch(() => []);
  const byName = new Map<string, string>();
  for (const it of dbItems) {
    byName.set(it.name, it.id);
    byName.set(it.marketHashName, it.id);
  }
  const linkMap: Record<string, string> = {};
  for (const m of items) {
    const id = byName.get(m.name);
    if (id) linkMap[m.slug] = id;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("mat.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("mat.sub")}</p>
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] leading-snug text-muted-foreground">
          {t("mat.dataNote")}
        </p>
      </div>
      <AdBanner placement="materials_top" />
      <MaterialsTable items={items} linkMap={linkMap} />
      <AdBanner placement="materials_bottom" />
    </div>
  );
}
