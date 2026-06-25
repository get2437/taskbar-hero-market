// このモジュールはサーバ専用 (Redis/外部fetch)。client から import してはいけない。
// `import "server-only"` は付けない: worker (tsx で生tsを実行) が fx.ts を import するが、
// server-only は Next が内部解決する疑似モジュールで node_modules に無く、tsx で MODULE_NOT_FOUND になるため。
import { cached, invalidate } from "@/lib/redis";
import { captureException } from "@/lib/monitoring";
import { CURRENCIES, STATIC_RATES, type Currency } from "@/lib/money";

const RATES_KEY = "fx:rates:usd";

/** 為替APIから USD 基準レートを取得。失敗時は静的フォールバック。 */
async function fetchUsdRates(): Promise<Record<Currency, number>> {
  try {
    // revalidate(=ISRキャッシュ)を使い、静的生成を動的に強制しない(no-store回避)。
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 12 * 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`fx HTTP ${res.status}`);
    const data = await res.json();
    const r = data?.rates;
    if (!r) throw new Error("fx: no rates in response");
    const out: Record<Currency, number> = { ...STATIC_RATES };
    for (const c of CURRENCIES) if (typeof r[c] === "number" && r[c] > 0) out[c] = r[c];
    out.USD = 1;
    return out;
  } catch (e) {
    captureException(e, { source: "fx/fetchUsdRates", level: "warning" });
    return STATIC_RATES;
  }
}

/** 表示用レート (USD基準)。Redis に12時間キャッシュ。Redis無し/失敗時は都度取得→静的。 */
export async function getRates(): Promise<Record<Currency, number>> {
  try {
    return await cached(RATES_KEY, 12 * 3600, fetchUsdRates);
  } catch {
    return STATIC_RATES;
  }
}

/** worker 日次: キャッシュを破棄して最新レートを取り直す。 */
export async function refreshRates(): Promise<Record<Currency, number>> {
  await invalidate("fx:");
  return getRates();
}
