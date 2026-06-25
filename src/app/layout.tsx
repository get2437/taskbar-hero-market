import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar, Topbar } from "@/components/nav";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale } from "@/lib/i18n/server";
import { ModeProvider } from "@/lib/mode/provider";
import { getMode } from "@/lib/mode/server";
import { MoneyProvider } from "@/lib/money/provider";
import { getMoney } from "@/lib/money/server";
import { ADS_ENABLED, ADSENSE_CLIENT } from "@/lib/ads/config";
import { ConsentBanner } from "@/components/consent-banner";
import { PageViewTracker } from "@/components/page-view-tracker";

const LOAD_ADSENSE = ADS_ENABLED && !!ADSENSE_CLIENT;

// プライバシー配慮型アクセス解析 (Plausible 互換・Cookie不使用)。env未設定なら無効。
const ANALYTICS_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const ANALYTICS_SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";

export const metadata: Metadata = {
  // `||` で空文字もフォールバック (Docker build は未設定時に空文字を渡すため。`??` だと new URL("") で失敗)
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Taskbar Hero Market Analytics",
    template: "%s · Taskbar Hero Market",
  },
  description:
    "Stock-style analytics for the Steam Community Market of Taskbar Hero — prices, rankings, anomalies, order book and forecasts.",
  openGraph: {
    title: "Taskbar Hero Market Analytics",
    description: "Stock-style analytics for the Steam Community Market of Taskbar Hero.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Taskbar Hero Market Analytics",
    description: "Stock-style analytics for the Steam Community Market of Taskbar Hero.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, mode, money] = await Promise.all([getLocale(), getMode(), getMoney()]);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {LOAD_ADSENSE && (
          <>
            {/* Consent Mode v2 の既定(denied)。AdSense読込より前に実行する。 */}
            <Script id="consent-default" strategy="beforeInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});try{if(localStorage.getItem('thb_consent')==='granted'){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}}catch(e){}`}
            </Script>
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
          </>
        )}
        {ANALYTICS_DOMAIN && (
          <Script defer data-domain={ANALYTICS_DOMAIN} src={ANALYTICS_SRC} strategy="afterInteractive" />
        )}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <I18nProvider locale={locale}>
            <MoneyProvider currency={money.currency} rates={money.rates}>
            <ModeProvider mode={mode}>
              <div className="flex min-h-screen">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Topbar />
                  <main className="flex-1 p-4 md:p-6">{children}</main>
                  <Footer />
                </div>
              </div>
              <ConsentBanner />
              <PageViewTracker />
            </ModeProvider>
            </MoneyProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
