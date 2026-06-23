"use client";
import { createContext, useContext } from "react";
import { DEFAULT_CURRENCY, STATIC_RATES, formatMoney, type Currency } from "./index";

interface MoneyCtx {
  currency: Currency;
  rates: Record<string, number>;
  /** 円(整数)を選択通貨で整形。 */
  fmt: (yen: number | null | undefined) => string;
}

const Ctx = createContext<MoneyCtx>({
  currency: DEFAULT_CURRENCY,
  rates: STATIC_RATES,
  fmt: (yen) => formatMoney(yen, DEFAULT_CURRENCY, STATIC_RATES),
});

export function MoneyProvider({
  currency,
  rates,
  children,
}: {
  currency: Currency;
  rates: Record<string, number>;
  children: React.ReactNode;
}) {
  const fmt = (yen: number | null | undefined) => formatMoney(yen, currency, rates);
  return <Ctx.Provider value={{ currency, rates, fmt }}>{children}</Ctx.Provider>;
}

export function useMoney(): MoneyCtx {
  return useContext(Ctx);
}
