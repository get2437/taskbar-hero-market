"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";

export function Footer() {
  const { t } = useT();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t px-4 py-6 text-xs text-muted-foreground md:px-6">
      <div className="mx-auto max-w-5xl space-y-2">
        <p>{t("footer.notAdvice")}</p>
        <p>{t("footer.notAffiliated")}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <span>© {year} Taskbar Hero Market</span>
          <Link href="/privacy" className="hover:underline hover:text-foreground">{t("nav.privacy")}</Link>
          <Link href="/disclaimer" className="hover:underline hover:text-foreground">{t("nav.disclaimer")}</Link>
        </div>
      </div>
    </footer>
  );
}
