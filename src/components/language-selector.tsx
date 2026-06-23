"use client";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_LABEL, LOCALE_COOKIE } from "@/lib/i18n";

export function LanguageSelector() {
  const router = useRouter();
  const { locale } = useT();

  function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    document.cookie = `${LOCALE_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <select
      aria-label="Language"
      defaultValue={locale}
      onChange={change}
      className="h-9 max-w-[7rem] rounded-lg border border-input bg-card px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:text-[15px]"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABEL[l]}
        </option>
      ))}
    </select>
  );
}
