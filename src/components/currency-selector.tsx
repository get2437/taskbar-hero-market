"use client";
import { useRouter } from "next/navigation";
import { useMoney } from "@/lib/money/provider";
import { CURRENCIES, CURRENCY_COOKIE } from "@/lib/money";

export function CurrencySelector() {
  const router = useRouter();
  const { currency } = useMoney();

  function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    document.cookie = `${CURRENCY_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
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
  );
}
