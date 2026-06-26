/**
 * 取得結果を DB へ反映する層。
 * Item を upsert し、MarketSnapshot を1件追加、ItemLatest を更新、
 * PriceHistory に1ポイント追記する。変化率(前日/7日/30日)も再計算する。
 */
import { prisma } from "@/lib/prisma";
import type { FetchedItem } from "./fetch";

const DAY = 86_400_000;

export interface StoreOptions {
  /** スナップショット/履歴の時刻 (シードで過去日付を入れる用) */
  at?: Date;
  /** 中間/平均/最高/出来高を上書き (priceOverview の結果がある場合) */
  enrich?: Map<string, { medianPrice?: number | null; averagePrice?: number | null; highestPrice?: number | null; volume?: number }>;
}

export async function storeFetched(items: FetchedItem[], opts: StoreOptions = {}): Promise<number> {
  const at = opts.at ?? new Date();
  let ok = 0;

  for (const f of items) {
    const enrich = opts.enrich?.get(f.marketHashName);
    const median = enrich?.medianPrice ?? null;
    // 検索取得では平均/最高は得られない。捏造(=最安のコピー)せず、実値が無ければ null。
    const average = enrich?.averagePrice ?? null;
    const highest = enrich?.highestPrice ?? null;
    const quantity = enrich?.volume ?? f.sellListings;

    const item = await prisma.item.upsert({
      where: { marketHashName: f.marketHashName },
      create: {
        marketHashName: f.marketHashName,
        name: f.name,
        imageUrl: f.imageUrl,
        type: f.attrs.type,
        part: f.attrs.part,
        grade: f.attrs.grade,
        classType: f.attrs.classType,
        level: f.attrs.level,
        active: true,
      },
      update: {
        name: f.name,
        imageUrl: f.imageUrl,
        type: f.attrs.type,
        classType: f.attrs.classType,
        // grade/part は名前から確信できる装備(GEAR)のときだけ更新。素材など名前にレア度/種別が
        // 無いものは classify が COMMON/NONE になるため、説明文由来の正確な値を上書きしない。
        ...(f.attrs.type === "GEAR" && { grade: f.attrs.grade, part: f.attrs.part }),
        // level は説明文由来の実レベル(Requires Lv.)を refreshDescriptions が保持するため、
        // 検索取得(レベル不明=null)では上書きしない。名前にLvがある場合のみ更新。
        ...(f.attrs.level != null && { level: f.attrs.level }),
        active: true,
      },
    });

    await prisma.marketSnapshot.create({
      data: {
        itemId: item.id,
        lowestPrice: f.lowestPrice,
        highestPrice: highest,
        medianPrice: median,
        averagePrice: average,
        quantity,
        createdAt: at,
      },
    });

    // 価格履歴ポイント (同一時刻の重複は無視)
    if (f.lowestPrice != null) {
      await prisma.priceHistory.upsert({
        where: { itemId_timestamp: { itemId: item.id, timestamp: at } },
        create: { itemId: item.id, price: f.lowestPrice, quantity, timestamp: at },
        update: { price: f.lowestPrice, quantity },
      });
    }

    const changes = await computeChanges(item.id, f.lowestPrice, at);

    await prisma.itemLatest.upsert({
      where: { itemId: item.id },
      create: {
        itemId: item.id,
        lowestPrice: f.lowestPrice,
        highestPrice: highest,
        medianPrice: median,
        averagePrice: average,
        quantity,
        fetchedAt: at,
        ...changes,
      },
      update: {
        lowestPrice: f.lowestPrice,
        highestPrice: highest,
        medianPrice: median,
        averagePrice: average,
        quantity,
        fetchedAt: at,
        ...changes,
      },
    });

    ok++;
  }

  return ok;
}

/** 価格履歴から前日比/7日比/30日比 (bps) を計算する。 */
async function computeChanges(itemId: string, current: number | null, at: Date) {
  if (current == null) return { changePrev: null, change7d: null, change30d: null };
  const since = new Date(at.getTime() - 31 * DAY);
  const history = await prisma.priceHistory.findMany({
    where: { itemId, timestamp: { gte: since, lt: at } },
    orderBy: { timestamp: "asc" },
    select: { price: true, timestamp: true },
  });

  const pick = (daysAgo: number): number | null => {
    const target = at.getTime() - daysAgo * DAY;
    let best: { price: number; diff: number } | null = null;
    for (const h of history) {
      const diff = Math.abs(h.timestamp.getTime() - target);
      if (!best || diff < best.diff) best = { price: h.price, diff };
    }
    return best ? best.price : null;
  };

  const bps = (base: number | null) =>
    base && base > 0 ? Math.round(((current - base) / base) * 10_000) : null;

  return {
    changePrev: bps(pick(1)),
    change7d: bps(pick(7)),
    change30d: bps(pick(30)),
  };
}
