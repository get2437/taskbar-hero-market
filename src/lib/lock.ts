/**
 * プロセス間で共有する分散ロック (Redis)。
 * アプリ(管理画面)と worker は別プロセスなので、メモリ上の状態では二重実行を防げない。
 * Steam取得系の重いジョブをこのロックで直列化し、手動操作と定期処理の競合(429/重複ログ)を防ぐ。
 * Redis 不在(ローカル単体)ではロック無しで実行する(=従来動作)。
 */
import { randomBytes } from "crypto";
import { redis } from "./redis";

// Steam取得系ジョブの共通ロックキー (runRefresh / refreshDescriptions が共有)
export const STEAM_JOB_LOCK = "lock:steam-job";

// 所有者トークン一致時のみ削除する (他者のロックを誤って解放しない)
const RELEASE_LUA = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

/** ロックが保持されているか (非ブロッキング確認用)。 */
export async function isLocked(key: string): Promise<boolean> {
  if (!redis) return false;
  try {
    return (await redis.exists(key)) === 1;
  } catch {
    return false;
  }
}

/**
 * ロックを取得して fn を実行する。取得できなければ実行せず { ran:false } を返す。
 * 長時間ジョブ用に TTL を定期延長し、プロセス異常終了時は TTL 失効で自動解放される。
 */
export async function withLock<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false }> {
  // Redis 無し → 直列化できないが実行はする (従来挙動)
  if (!redis) return { ran: true, value: await fn() };

  const token = randomBytes(16).toString("hex");
  let acquired = false;
  try {
    acquired = (await redis.set(key, token, "EX", ttlSec, "NX")) === "OK";
  } catch {
    // Redis 障害時はブロックせず実行 (可用性優先)
    return { ran: true, value: await fn() };
  }
  if (!acquired) return { ran: false };

  // TTL の半分ごとに延長して、稼働中のロック失効を防ぐ
  const renew = setInterval(() => {
    redis?.expire(key, ttlSec).catch(() => {});
  }, Math.max(1, Math.floor(ttlSec / 2)) * 1000);

  try {
    return { ran: true, value: await fn() };
  } finally {
    clearInterval(renew);
    try {
      await redis.eval(RELEASE_LUA, 1, key, token);
    } catch {
      /* 解放失敗は TTL 失効に任せる */
    }
  }
}
