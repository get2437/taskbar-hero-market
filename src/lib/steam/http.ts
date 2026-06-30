/**
 * Steam向け共通HTTP。指数バックオフ+ジッタ+タイムアウトで、
 * Steam障害・レート制限(429)・タイムアウト・一時的5xxに耐える。
 * 429が続く時はサーキットブレーカー(クールダウン)で一定時間Steamへの要求を止める。
 */
import { steamCooldownRemainingMs, setSteamCooldown } from "./cooldown";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 429 を受けた後に Steam へ一切要求しない時間 (IP回復のため)。Retry-After があれば尊重。
// 15分だと制限が解ける前に再プローブして再び429→延長…のループに陥りやすいので、30分に延長。
const COOLDOWN_MS = Number(process.env.STEAM_COOLDOWN_MS ?? 30 * 60_000);
const COOLDOWN_MAX_MS = 90 * 60_000;

export class SteamCooldownError extends Error {
  constructor(remainingMs: number) {
    super(`Steam rate-limit cooldown: ${Math.ceil(remainingMs / 1000)}s remaining (429)`);
    this.name = "SteamCooldownError";
  }
}

function backoffMs(attempt: number, baseMs: number): number {
  const exp = baseMs * 2 ** attempt;
  return Math.round(exp + Math.random() * exp * 0.3); // ジッタ ±30%
}

export interface SteamFetchOptions {
  headers?: Record<string, string>;
  retries?: number; // 既定3
  timeoutMs?: number; // 既定12s
  baseBackoffMs?: number; // 既定600ms
}

/** 失敗時は指数バックオフで再試行。最終的に失敗したら例外。 */
export async function steamFetch(url: string, opts: SteamFetchOptions = {}): Promise<Response> {
  // クールダウン中は一切要求しない (制限中に叩き続けて429が解消しないのを防ぐ)。
  const cd = await steamCooldownRemainingMs();
  if (cd > 0) throw new SteamCooldownError(cd);

  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const base = opts.baseBackoffMs ?? 600;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json,text/html;q=0.9", ...opts.headers },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      // 429 / 5xx は再試行対象
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(backoffMs(attempt, res.status === 429 ? base * 4 : base));
        continue;
      }
      // リトライしても429 → クールダウン発動 (Retry-Afterを尊重しつつ上限内)。以降は即スキップ。
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after")) * 1000;
        const ms = Math.min(COOLDOWN_MAX_MS, Math.max(COOLDOWN_MS, Number.isFinite(ra) && ra > 0 ? ra : 0));
        await setSteamCooldown(ms);
        throw new SteamCooldownError(ms);
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof SteamCooldownError) throw e;
      lastErr = e;
      if (attempt < retries) {
        await sleep(backoffMs(attempt, base));
        continue;
      }
    }
  }
  throw lastErr ?? new Error(`steamFetch failed: ${url}`);
}

/** JSONを取得。失敗時は null (呼び出し側でフォールバック)。 */
export async function steamFetchJson<T = any>(url: string, opts: SteamFetchOptions = {}): Promise<T | null> {
  try {
    const res = await steamFetch(url, opts);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
