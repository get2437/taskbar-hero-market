import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// REDIS_URL が無い環境 (ローカルの単体 next dev など) では null を返し、
// 呼び出し側はキャッシュ無しで動作する。
function createRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  client.on("error", (e) => {
    // 接続不可でもアプリは落とさない
    if (process.env.NODE_ENV === "development") {
      console.warn("[redis] error:", e.message);
    }
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis ?? undefined;

/** キャッシュ取得→無ければ producer を実行して保存する汎用ヘルパ。 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  if (!redis) return producer();
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    /* キャッシュ読み取り失敗は無視 */
  }
  const value = await producer();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* 書き込み失敗は無視 */
  }
  return value;
}

/** プレフィックス一致でキャッシュを削除 (管理画面のキャッシュ削除用)。 */
export async function invalidate(prefix: string): Promise<number> {
  if (!redis) return 0;
  let cursor = "0";
  let removed = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
    cursor = next;
    if (keys.length) {
      removed += await redis.del(...keys);
    }
  } while (cursor !== "0");
  return removed;
}
