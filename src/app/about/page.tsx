import type { Metadata } from "next";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { GradeBadge } from "@/components/domain";
import { safeJsonLd } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GRADES = ["COMMON", "UNCOMMON", "RARE", "LEGENDARY", "IMMORTAL", "ARCANA", "BEYOND", "CELESTIAL", "DIVINE", "COSMIC"];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return { title: t("about.title"), description: t("about.intro").slice(0, 160), ...(site ? { alternates: { canonical: `${site}/about` } } : {}) };
}

export default async function AboutPage() {
  const { t } = await getTranslator();

  const faq = [
    { q: t("about.q1"), a: t("about.a1") },
    { q: t("about.q2"), a: t("about.a2") },
    { q: t("about.q3"), a: t("about.a3") },
  ];
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const links = [
    { href: "/", label: t("nav.items") },
    { href: "/gear", label: t("nav.gear") },
    { href: "/materials", label: t("nav.materials") },
    { href: "/rankings", label: t("nav.rankings") },
    { href: "/news", label: t("nav.news") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />

      <header>
        <h1 className="text-2xl font-bold">{t("about.title")}</h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">{t("about.intro")}</p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("about.featuresTitle")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("about.f1")}</li>
          <li>{t("about.f2")}</li>
          <li>{t("about.f3")}</li>
          <li>{t("about.f4")}</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("about.gradesTitle")}</h2>
        <p className="mb-2 text-sm text-muted-foreground">{t("about.grades")}</p>
        <div className="flex flex-wrap gap-1.5">
          {GRADES.map((g) => (
            <GradeBadge key={g} grade={g} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("about.dataTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("about.data")}</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("about.faqTitle")}</h2>
        <dl className="space-y-3">
          {faq.map((f, i) => (
            <div key={i} className="rounded-lg border p-3">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="flex flex-wrap gap-2 border-t pt-4" aria-label={t("home.explore")}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
