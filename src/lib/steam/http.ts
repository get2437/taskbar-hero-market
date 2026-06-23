/**
 * Steam向け共通HTTP。指数バックオフ+ジッタ+タイムアウトで、
 * Steam障害・レート制限(429)・タイムアウト・一時的5xxに耐える。
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      return res;
    } catch (e) {
      clearTimeout(timer);
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
