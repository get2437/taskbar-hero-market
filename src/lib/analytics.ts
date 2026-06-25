import { prisma } from "@/lib/prisma";

/**
 * アクセス解析: PageView を時間粒度ごとに集計する。
 * バケット境界はUTCで計算(タイムゾーン依存を避ける)。表示ラベルはクライアントでロケール整形。
 */
export type Gran = "hour" | "day" | "month" | "year";
export interface Bucket {
  bucket: string; // バケット開始時刻 (ISO, UTC)
  count: number;
}

const CFG: Record<Gran, number> = { hour: 24, day: 30, month: 12, year: 5 };

// 直近 count 個のバケット開始時刻 (UTC, 昇順)。最後が現在のバケット。
function bucketStarts(gran: Gran, count: number): Date[] {
  const now = new Date();
  const Y = now.getUTCFullYear(), M = now.getUTCMonth(), D = now.getUTCDate(), H = now.getUTCHours();
  const out: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    if (gran === "hour") out.push(new Date(Date.UTC(Y, M, D, H) - i * 3_600_000));
    else if (gran === "day") out.push(new Date(Date.UTC(Y, M, D) - i * 86_400_000));
    else if (gran === "month") out.push(new Date(Date.UTC(Y, M - i, 1)));
    else out.push(new Date(Date.UTC(Y - i, 0, 1)));
  }
  return out;
}

function bucketIndex(gran: Gran, since: Date, t: Date, count: number): number {
  let idx: number;
  if (gran === "hour") idx = Math.floor((t.getTime() - since.getTime()) / 3_600_000);
  else if (gran === "day") idx = Math.floor((t.getTime() - since.getTime()) / 86_400_000);
  else if (gran === "month") idx = (t.getUTCFullYear() - since.getUTCFullYear()) * 12 + (t.getUTCMonth() - since.getUTCMonth());
  else idx = t.getUTCFullYear() - since.getUTCFullYear();
  return idx >= 0 && idx < count ? idx : -1;
}

async function seriesFor(gran: Gran): Promise<Bucket[]> {
  const count = CFG[gran];
  const starts = bucketStarts(gran, count);
  const since = starts[0];
  const rows = await prisma.pageView.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  const counts = new Array(count).fill(0);
  for (const r of rows) {
    const i = bucketIndex(gran, since, r.createdAt, count);
    if (i >= 0) counts[i]++;
  }
  return starts.map((d, i) => ({ bucket: d.toISOString(), count: counts[i] }));
}

export async function getPageViewBuckets(): Promise<Record<Gran, Bucket[]>> {
  const [hour, day, month, year] = await Promise.all([
    seriesFor("hour"), seriesFor("day"), seriesFor("month"), seriesFor("year"),
  ]);
  return { hour, day, month, year };
}
