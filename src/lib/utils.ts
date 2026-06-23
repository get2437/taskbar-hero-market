import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 価格は「最小通貨単位 (Int)」で保持している。
 * JPY(23) は最小単位=1円なので 12300 -> "¥12,300"。
 * USD(1) は最小単位=セントなので 1234 -> "$12.34"。
 */
const CURRENCY = Number(process.env.NEXT_PUBLIC_STEAM_CURRENCY ?? process.env.STEAM_CURRENCY ?? 8);

// Steam currency code -> 表示メタ (8=JPY, 16=KRW は小数0桁 / 23=CNY)
const CURRENCY_META: Record<number, { code: string; locale: string; fractionDigits: number }> = {
  1: { code: "USD", locale: "en-US", fractionDigits: 2 },
  8: { code: "JPY", locale: "ja-JP", fractionDigits: 0 },
  16: { code: "KRW", locale: "ko-KR", fractionDigits: 0 },
  23: { code: "CNY", locale: "zh-CN", fractionDigits: 2 },
  2: { code: "GBP", locale: "en-GB", fractionDigits: 2 },
  3: { code: "EUR", locale: "de-DE", fractionDigits: 2 },
};

export function formatPrice(minor: number | null | undefined, currency = CURRENCY): string {
  if (minor == null) return "—";
  const meta = CURRENCY_META[currency] ?? CURRENCY_META[8];
  const value = minor / Math.pow(10, meta.fractionDigits);
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    maximumFractionDigits: meta.fractionDigits,
  }).format(value);
}

/** 構造化データ(JSON-LD)用: 最小単位 → {金額(主要単位), 通貨コード}。 */
export function priceParts(minor: number, currency = CURRENCY): { amount: number; currency: string } {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META[8];
  return { amount: minor / Math.pow(10, meta.fractionDigits), currency: meta.code };
}

/** basis points (100 = 1.00%) を "+12.3%" の様に整形。 */
export function formatBps(bps: number | null | undefined): string {
  if (bps == null) return "—";
  const pct = bps / 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("ja-JP").format(n);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** 変化率の符号に応じた tailwind 色クラス。 */
export function changeColor(bps: number | null | undefined): string {
  if (bps == null || bps === 0) return "text-muted-foreground";
  return bps > 0 ? "text-up" : "text-down";
}
