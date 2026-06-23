"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";
import { ADS_ENABLED } from "@/lib/ads/config";

const KEY = "thb_consent";

/**
 * 広告の同意バナー (CMP の最小実装 / Google Consent Mode v2 連携)。
 * - 既定の consent は layout の inline スクリプトで「denied」に設定済み。
 * - ここでは「同意/拒否」を保存し、同意時のみ gtag consent update で granted にする。
 * - 広告が有効(ADS_ENABLED)で、未選択のときだけ表示する。
 * 注: IAB TCF 完全準拠が必要な場合は Google 認定 CMP の利用を推奨。
 */
export function ConsentBanner() {
  const { t } = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* localStorage 不可環境では出さない */
    }
  }, []);

  function decide(granted: boolean) {
    try {
      localStorage.setItem(KEY, granted ? "granted" : "denied");
    } catch {
      /* ignore */
    }
    if (granted) {
      window.gtag?.("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted",
      });
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 p-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          {t("consent.message")}{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            {t("consent.learnMore")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide(false)}
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            {t("consent.reject")}
          </button>
          <button
            onClick={() => decide(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("consent.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
