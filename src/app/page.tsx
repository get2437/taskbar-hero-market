import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ItemsBrowser } from "@/components/items-browser";
import { getTranslator } from "@/lib/i18n/server";
import { getLastUpdated } from "@/lib/queries";
import { AdBanner } from "@/components/ads";
import { LiveRefresh } from "@/components/live-refresh";
import { safeJsonLd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  // トップは検索で最重要。H1ラベルではなくキーワードを含む独立したSEOタイトル/説明にする。
  // canonical をルートに固定し、?sort= や ?filter= の重複URLを正規化する。
  return {
    title: { absolute: "Taskbar Hero Market — Prices, Rankings & Price Forecasts" },
    description:
      "Live Steam Community Market prices, rankings, anomalies, order books and price forecasts for Taskbar Hero (TBH) items — free stock-style market analytics.",
    ...(site ? { alternates: { canonical: site } } : {}),
  };
}

// ホーム = アイテム一覧
export default async function HomePage() {
  const { t } = await getTranslator();
  const lastUpdated = await getLastUpdated();
  const updatedText = lastUpdated
    ? lastUpdated.toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : t("market.noData");

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Taskbar Hero Market Analytics",
    description: "Stock-style analytics for the Steam Community Market of Taskbar Hero.",
    ...(site ? { url: site } : {}),
    // サイトリンク検索ボックス: Googleにサイト内検索を伝える
    ...(site
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${site}/?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Taskbar Hero Market",
    ...(site ? { url: site, logo: `${site}/icon-512.png` } : {}),
  };

  // SEO用の内部リンク (サーバ描画。クライアント描画の一覧と別に、クロール経路とテキストを供給)
  const sections = [
    { href: "/gear", label: t("nav.gear") },
    { href: "/materials", label: t("nav.materials") },
    { href: "/rankings", label: t("nav.rankings") },
    { href: "/news", label: t("nav.news") },
    { href: "/dashboard", label: t("nav.dashboard") },
  ];

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(siteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgLd) }} />
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-bold">{t("items.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("items.sub")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          🔄 {t("market.updated")}: <span className="tabular">{updatedText}</span>
          <span className="opacity-70"> · {t("market.autoUpdate")}</span>
        </p>
      </div>
      {/* 広告: 一覧上部 */}
      <AdBanner placement="items_top" />
      <Suspense fallback={<div className="text-sm text-muted-foreground">{t("common.loading")}</div>}>
        <ItemsBrowser />
      </Suspense>
      {/* 広告: 一覧下部 */}
      <AdBanner placement="items_bottom" />

      {/* SEO: サーバ描画の説明文＋内部リンク (一覧はクライアント描画のため、クロール用の本文/導線をここで補う) */}
      <section className="mt-2 border-t pt-4 text-sm text-muted-foreground">
        <p className="max-w-3xl leading-relaxed">{t("home.seoIntro")}</p>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label={t("home.explore")}>
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="rounded-full border px-3 py-1 text-xs hover:bg-accent hover:text-foreground">
              {s.label}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
