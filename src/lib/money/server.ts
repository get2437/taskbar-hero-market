import "server-only";
import { cookies } from "next/headers";
import { getLocale } from "@/lib/i18n/server";
import { getRates } from "@/lib/fx";
import { CURRENCY_COOKIE, currencyForLocale, formatMoney, isCurrency, type Currency } from "./index";

/** サーバコンポーネント用: cookie から表示通貨を解決 (無ければ言語の既定通貨)。 */
export async function getCurrency(): Promise<Currency> {
  const c = await cookies();
  const v = c.get(CURRENCY_COOKIE)?.value;
  if (isCurrency(v)) return v;
  return currencyForLocale(await getLocale());
}

/** サーバコンポーネント用: 通貨/レート/整形関数をまとめて取得。 */
export async function getMoney() {
  const [currency, rates] = await Promise.all([getCurrency(), getRates()]);
  return {
    currency,
    rates,
    fmt: (yen: number | null | undefined) => formatMoney(yen, currency, rates),
  };
}
