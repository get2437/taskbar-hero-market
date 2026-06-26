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

  // 素材 → DBアイテムの対応付け。詳細リンク用の id と、表示用のライブ最安値(円)を取得する。
  // 素材の market_hash_name は名前と一致するため name / marketHashName 両方で照合する。
  const names = items.map((m) => m.name);
  const dbItems = await prisma.item
    .findMany({
      where: { OR: [{ name: { in: names } }, { marketHashName: { in: names } }] },
      select: { id: true, name: true, marketHashName: true, latest: { select: { lowestPrice: true } } },
    })
    .catch(() => []);
  const byName = new Map<string, { id: string; price: number | null }>();
  for (const it of dbItems) {
    const v = { id: it.id, price: it.latest?.lowestPrice ?? null };
    byName.set(it.name, v);
    byName.set(it.marketHashName, v);
  }
  const linkMap: Record<string, string> = {};
  const priceMap: Record<string, number> = {}; // slug -> ライブ最安値(円)
  for (const m of items) {
    const hit = byName.get(m.name);
    if (hit) {
      linkMap[m.slug] = hit.id;
      if (hit.price != null) priceMap[m.slug] = hit.price;
    }
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
      <MaterialsTable items={items} linkMap={linkMap} priceMap={priceMap} />
      <AdBanner placement="materials_bottom" />
    </div>
  );
}
