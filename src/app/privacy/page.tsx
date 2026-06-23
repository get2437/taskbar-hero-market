import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy Policy", robots: { index: true, follow: true } };

// ⚠️ これは公開前に内容を確認・調整してください（雛形）。連絡先メールは実際のものに。
const JA = {
  title: "プライバシーポリシー",
  updated: "最終更新: 2026-06-16",
  body: [
    ["概要", "本サイト（Taskbar Hero Market、以下「当サイト」）は、Steam コミュニティマーケットの価格分析ツールです。アカウント登録・ログインは不要で、氏名・メールアドレス・パスワード等の個人情報を取得しません。"],
    ["端末に保存される情報", "言語・購入/販売モード・テーマ（ダーク/ライト）などの表示設定を、お使いの端末の Cookie / localStorage に保存します。これらは設定の保持のみに使用します。"],
    ["お気に入り・通知", "お気に入りや価格アラートを利用した場合、その内容は匿名のセッション識別子に紐づけてサーバーに保存されます。個人の身元とは結び付けません。"],
    ["広告について", "広告を有効化している場合、Google AdSense が Cookie 等を用いて広告を配信することがあります（Google のポリシーに従います）。ユーザーは Google の広告設定でパーソナライズ広告を無効化できます。広告を無効化している間は、広告 Cookie もスクリプトも読み込まれません。"],
    ["アクセス解析", "アクセス解析を有効化している場合、Cookie を用いず個人を特定しないプライバシー配慮型の解析（例: Plausible）を使用します。"],
    ["第三者提供・販売", "当サイトは個人を特定する情報を販売しません。"],
    ["お問い合わせ", "本ポリシーに関するお問い合わせは contact@<あなたのドメイン> まで。"],
  ],
};

const EN = {
  title: "Privacy Policy",
  updated: "Last updated: 2026-06-16",
  body: [
    ["Overview", "Taskbar Hero Market (the “Site”) is an analytics tool for the Steam Community Market. No account or login is required, and we do not collect personal information such as names, email addresses, or passwords."],
    ["Stored on your device", "Display preferences (language, buy/sell mode, dark/light theme) are stored in cookies / localStorage on your device, solely to remember your settings."],
    ["Favorites & alerts", "If you use favorites or price alerts, that data is stored on our server under an anonymous session identifier and is not linked to your personal identity."],
    ["Advertising", "When advertising is enabled, Google AdSense may use cookies to serve ads, in accordance with Google’s policies. You can opt out of personalized ads via Google Ads Settings. While ads are disabled, no ad cookies or scripts are loaded."],
    ["Analytics", "When analytics is enabled, we use a privacy-friendly, cookieless analytics tool (e.g. Plausible) that does not collect personally identifiable information."],
    ["No sale of data", "We do not sell personally identifiable information."],
    ["Contact", "For questions about this policy, contact contact@<your-domain>."],
  ],
};

export default async function PrivacyPage() {
  const locale = await getLocale();
  const c = locale === "ja" ? JA : EN;
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="text-xs text-muted-foreground">{c.updated}</p>
      </div>
      {c.body.map(([h, p]) => (
        <section key={h} className="space-y-1">
          <h2 className="text-base font-semibold">{h}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{p}</p>
        </section>
      ))}
    </article>
  );
}
