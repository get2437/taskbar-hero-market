// 通貨表示の純粋ロジック (クライアント/サーバ共用・redis等の副作用なし)。
// JPY が Steam 実データの基軸。他通貨は USD 基準レートで換算表示する(≈付き)。

export const CURRENCIES = [
  "USD", "EUR", "JPY", "KRW", "CNY", "RUB", "BRL",
  // 追加: 英/加/豪/印/台 + 東南アジア(香/星/泰/尼/比)
  "GBP", "CAD", "AUD", "INR", "TWD", "HKD", "SGD", "THB", "IDR", "PHP",
] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "USD";
export const CURRENCY_COOKIE = "currency";

// USD基準の静的フォールバックレート (1 USD = X)。本番は worker が日次でAPI更新。
export const STATIC_RATES: Record<Currency, number> = {
  USD: 1, EUR: 0.92, JPY: 150, KRW: 1350, CNY: 7.2, RUB: 90, BRL: 5.4,
  GBP: 0.79, CAD: 1.36, AUD: 1.52, INR: 83, TWD: 32, HKD: 7.8, SGD: 1.35, THB: 36, IDR: 16000, PHP: 58,
};

// 言語 -> 既定の表示通貨
export const CURRENCY_BY_LOCALE: Record<string, Currency> = {
  en: "USD", ja: "JPY", ko: "KRW", zh: "CNY", ru: "RUB", pt: "BRL", es: "EUR", fr: "EUR", de: "EUR",
  it: "EUR", pl: "EUR", tr: "EUR", th: "THB", vi: "USD",
};

const META: Record<Currency, { locale: string; dec: number }> = {
  USD: { locale: "en-US", dec: 2 },
  EUR: { locale: "de-DE", dec: 2 },
  JPY: { locale: "ja-JP", dec: 0 },
  KRW: { locale: "ko-KR", dec: 0 },
  CNY: { locale: "zh-CN", dec: 2 },
  RUB: { locale: "ru-RU", dec: 0 },
  BRL: { locale: "pt-BR", dec: 2 },
  GBP: { locale: "en-GB", dec: 2 },
  CAD: { locale: "en-CA", dec: 2 },
  AUD: { locale: "en-AU", dec: 2 },
  INR: { locale: "en-IN", dec: 2 },
  TWD: { locale: "zh-TW", dec: 0 },
  HKD: { locale: "zh-HK", dec: 2 },
  SGD: { locale: "en-SG", dec: 2 },
  THB: { locale: "th-TH", dec: 2 },
  IDR: { locale: "id-ID", dec: 0 },
  PHP: { locale: "en-PH", dec: 2 },
};

export function isCurrency(v: string | null | undefined): v is Currency {
  return !!v && (CURRENCIES as readonly string[]).includes(v);
}

export function currencyForLocale(locale: string): Currency {
  return CURRENCY_BY_LOCALE[locale] ?? DEFAULT_CURRENCY;
}

/**
 * 円(整数)を選択通貨へ換算して整形する。
 * JPY は実データなのでそのまま、他通貨は USD 基準レートで換算し ≈ を付ける。
 */
export function formatMoney(
  yen: number | null | undefined,
  currency: Currency,
  rates: Record<string, number>,
): string {
  if (yen == null) return "—";
  const r = rates ?? STATIC_RATES;
  const rate = (r[currency] ?? STATIC_RATES[currency]) / (r.JPY ?? STATIC_RATES.JPY);
  const value = yen * rate;
  const m = META[currency];
  const s = new Intl.NumberFormat(m.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: m.dec,
  }).format(value);
  return currency === "JPY" ? s : "≈" + s; // ≈ (換算値)
}

/**
 * 価格の出所はSteamのUSD建て。その換算基準を「$1 ≈ <選択通貨>」で表す。
 * USD選択時は換算なし(原価)なので null。FX由来なので常に ≈ 付き。
 */
export function usdRateLabel(currency: Currency, rates: Record<string, number>): string | null {
  if (currency === "USD") return null;
  const r = rates ?? STATIC_RATES;
  const per = r[currency] ?? STATIC_RATES[currency]; // 1 USD = per (選択通貨), rates は USD 基準
  const m = META[currency];
  const s = new Intl.NumberFormat(m.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: m.dec === 0 ? 0 : 2,
  }).format(per);
  return `$1≈${s}`;
}
