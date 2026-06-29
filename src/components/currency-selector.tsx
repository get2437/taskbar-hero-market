"use client";
import { useRouter } from "next/navigation";
import { useMoney } from "@/lib/money/provider";
import { CURRENCIES, CURRENCY_COOKIE, usdRateLabel } from "@/lib/money";

export function CurrencySelector() {
  const router = useRouter();
  const { currency, rates } = useMoney();
  const rate = usdRateLabel(currency, rates);

  function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    document.cookie = `${CURRENCY_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      {rate && (
        <span
          className="whitespace-nowrap text-[10px] leading-tight text-muted-foreground tabular sm:text-xs"
          title="Steam価格はUSD建て。表示はこのレートで換算（≈）"
        >
          {rate}
        </span>
      )}
      <select
        aria-label="Currency"
        value={currency}
        onChange={change}
        className="h-9 rounded-lg border border-input bg-card px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:text-[15px]"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
