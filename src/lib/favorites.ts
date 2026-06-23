/**
 * お気に入り / フォルダ / 損益シミュレーション。
 */
import { prisma } from "@/lib/prisma";
import { serializeItemRow } from "@/lib/queries";

// Steam マーケット手数料: 売値に対し 10%(Steam) + 5%(ゲーム) = 約15%
export const STEAM_FEE_RATE = 0.15;

export interface FavoriteView extends ReturnType<typeof serializeItemRow> {
  favoriteId: string;
  folderId: string | null;
  memo: string | null;
  purchasePrice: number | null;
  // 損益シミュレーション
  profit: number | null;        // 手数料考慮前
  profitAfterFee: number | null; // 手数料考慮後
  profitRate: number | null;     // bps
}

export type FavoriteSort = "price" | "change" | "created" | "score";

export async function listFavorites(userId: string, folderId?: string | null, sort: FavoriteSort = "created") {
  const favorites = await prisma.favorite.findMany({
    where: { userId, ...(folderId ? { folderId } : {}) },
    include: { item: { include: { latest: true, analysis: true } } },
    orderBy: { createdAt: "desc" },
  });

  const views: FavoriteView[] = favorites.map((f) => {
    const row = serializeItemRow(f.item);
    const cur = row.lowestPrice;
    let profit: number | null = null;
    let profitAfterFee: number | null = null;
    let profitRate: number | null = null;
    if (f.purchasePrice != null && cur != null) {
      profit = cur - f.purchasePrice;
      profitAfterFee = Math.round(cur * (1 - STEAM_FEE_RATE)) - f.purchasePrice;
      profitRate = f.purchasePrice > 0 ? Math.round((profit / f.purchasePrice) * 10_000) : null;
    }
    return {
      ...row,
      favoriteId: f.id,
      folderId: f.folderId,
      memo: f.memo,
      purchasePrice: f.purchasePrice,
      profit,
      profitAfterFee,
      profitRate,
    };
  });

  const sorted = [...views].sort((a, b) => {
    switch (sort) {
      case "price":
        return (b.lowestPrice ?? -1) - (a.lowestPrice ?? -1);
      case "change":
        return (b.change7d ?? -Infinity) - (a.change7d ?? -Infinity);
      case "score":
        return (b.investmentScore ?? -1) - (a.investmentScore ?? -1);
      default:
        return 0; // created: 既に降順
    }
  });

  return sorted;
}

export async function getFavoriteSummary(userId: string) {
  const favs = await prisma.favorite.findMany({
    where: { userId },
    include: { item: { include: { latest: true } } },
  });
  let upToday = 0;
  let downToday = 0;
  let totalProfitAfterFee = 0;
  let hasPurchase = false;
  for (const f of favs) {
    const cp = f.item.latest?.changePrev;
    if (cp != null && cp > 0) upToday++;
    if (cp != null && cp < 0) downToday++;
    const cur = f.item.latest?.lowestPrice;
    if (f.purchasePrice != null && cur != null) {
      hasPurchase = true;
      totalProfitAfterFee += Math.round(cur * (1 - STEAM_FEE_RATE)) - f.purchasePrice;
    }
  }
  const pendingAlerts = await prisma.priceAlert.count({ where: { userId, enabled: true } });
  return {
    count: favs.length,
    upToday,
    downToday,
    totalProfitAfterFee: hasPurchase ? totalProfitAfterFee : null,
    pendingAlerts,
  };
}

export async function isFavorited(userId: string, itemId: string) {
  const f = await prisma.favorite.findUnique({ where: { userId_itemId: { userId, itemId } } });
  return !!f;
}

export async function toggleFavorite(userId: string, itemId: string) {
  const existing = await prisma.favorite.findUnique({ where: { userId_itemId: { userId, itemId } } });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    await adjustFavoriteStat(itemId, -1);
    return { favorited: false };
  }
  await prisma.favorite.create({ data: { userId, itemId } });
  await adjustFavoriteStat(itemId, +1);
  return { favorited: true };
}

async function adjustFavoriteStat(itemId: string, delta: number) {
  await prisma.favoriteStat.upsert({
    where: { itemId },
    create: { itemId, total: Math.max(0, delta), last24h: Math.max(0, delta) },
    update: { total: { increment: delta } },
  });
}

export async function listFolders(userId: string) {
  const folders = await prisma.folder.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { favorites: true } } },
  });
  return folders.map((f) => ({ id: f.id, name: f.name, color: f.color, count: f._count.favorites }));
}
