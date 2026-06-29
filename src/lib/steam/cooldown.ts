/**
 * Steam レート制限(429)のサーキットブレーカー。
 * 429 を受けたら一定時間「クールダウン」に入り、その間は一切 Steam へ要求しない。
 * これにより、制限中に worker が叩き続けて 429 が解消しない事態(=ずっと429)を防ぐ。
 * 状態は Redis 共有 (app/worker 両プロセスで効く) + プロセス内キャッシュ。
 */
import { redis } from "@/lib/redis";

const KEY = "steam:cooldown";
const g = globalThis as unknown as { __steamCooldownUntil?: number };

/** 残りクールダウン(ms)。0 なら通常運転。 */
export async function steamCooldownRemainingMs(): Promise<number> {
  const mem = (g.__steamCooldownUntil ?? 0) - Date.now();
  if (mem > 0) return mem;
  if (redis) {
    try {
      const pttl = await redis.pttl(KEY); // -2:なし -1:無期限 >0:残ms
      if (pttl > 0) {
        g.__steamCooldownUntil = Date.now() + pttl;
        return pttl;
      }
    } catch {
      /* redis不調は無視 */
    }
  }
  return 0;
}

/** クールダウンを設定 (既存より長ければ延長)。 */
export async function setSteamCooldown(ms: number): Promise<void> {
  const until = Date.now() + ms;
  if (until > (g.__steamCooldownUntil ?? 0)) g.__steamCooldownUntil = until;
  if (redis) {
    try {
      // 既存TTLより長い時だけ上書き (短縮しない)
      const cur = await redis.pttl(KEY);
      if (cur < ms) await redis.set(KEY, "1", "PX", ms);
    } catch {
      /* ignore */
    }
  }
}
