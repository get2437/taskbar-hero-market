/**
 * ホットアイテム (今まさに閲覧されている銘柄) の追跡。
 * 詳細/注文板APIが叩かれたら markHot し、ワーカーが優先的に最新化する。
 */
import { redis } from "./redis";

const TTL = 120; // 秒

export async function markHot(itemId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`hot:${itemId}`, "1", "EX", TTL);
  } catch {
    /* ignore */
  }
}

export async function getHotItemIds(limit = 60): Promise<string[]> {
  if (!redis) return [];
  const out: string[] = [];
  let cursor = "0";
  try {
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", "hot:*", "COUNT", 100);
      cursor = next;
      for (const k of keys) {
        out.push(k.slice(4));
        if (out.length >= limit) return out;
      }
    } while (cursor !== "0");
  } catch {
    /* ignore */
  }
  return out;
}
