import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy Policy", robots: { index: true, follow: true } };

// ⚠️ 公開前に内容を確認・調整してください（雛形）。連絡先メールは実際のものに。
type Content = { title: string; updated: string; body: [string, string][] };
const UPDATED = "2026-06-16";
const CONTACT = "contact@<your-domain>";

const CONTENT: Partial<Record<Locale, Content>> & { en: Content } = {
  en: {
    title: "Privacy Policy",
    updated: `Last updated: ${UPDATED}`,
    body: [
      ["Overview", "Taskbar Hero Market (the “Site”) is an analytics tool for the Steam Community Market. No account or login is required, and we do not collect personal information such as names, email addresses, or passwords."],
      ["Stored on your device", "Display preferences (language, buy/sell mode, dark/light theme) are stored in cookies / localStorage on your device, solely to remember your settings."],
      ["Favorites & alerts", "If you use favorites or price alerts, that data is stored on our server under an anonymous session identifier and is not linked to your personal identity."],
      ["Advertising", "When advertising is enabled, Google AdSense may use cookies to serve ads, in accordance with Google’s policies. You can opt out of personalized ads via Google Ads Settings. While ads are disabled, no ad cookies or scripts are loaded."],
      ["Analytics", "When analytics is enabled, we use a privacy-friendly, cookieless analytics tool (e.g. Plausible) that does not collect personally identifiable information."],
      ["No sale of data", "We do not sell personally identifiable information."],
      ["Contact", `For questions about this policy, contact ${CONTACT}.`],
    ],
  },
  ja: {
    title: "プライバシーポリシー",
    updated: `最終更新: ${UPDATED}`,
    body: [
      ["概要", "本サイト（Taskbar Hero Market、以下「当サイト」）は、Steam コミュニティマーケットの価格分析ツールです。アカウント登録・ログインは不要で、氏名・メールアドレス・パスワード等の個人情報を取得しません。"],
      ["端末に保存される情報", "言語・購入/販売モード・テーマ（ダーク/ライト）などの表示設定を、お使いの端末の Cookie / localStorage に保存します。これらは設定の保持のみに使用します。"],
      ["お気に入り・通知", "お気に入りや価格アラートを利用した場合、その内容は匿名のセッション識別子に紐づけてサーバーに保存されます。個人の身元とは結び付けません。"],
      ["広告について", "広告を有効化している場合、Google AdSense が Cookie 等を用いて広告を配信することがあります（Google のポリシーに従います）。ユーザーは Google の広告設定でパーソナライズ広告を無効化できます。広告を無効化している間は、広告 Cookie もスクリプトも読み込まれません。"],
      ["アクセス解析", "アクセス解析を有効化している場合、Cookie を用いず個人を特定しないプライバシー配慮型の解析（例: Plausible）を使用します。"],
      ["第三者提供・販売", "当サイトは個人を特定する情報を販売しません。"],
      ["お問い合わせ", `本ポリシーに関するお問い合わせは ${CONTACT} まで。`],
    ],
  },
  ko: {
    title: "개인정보 처리방침",
    updated: `최종 업데이트: ${UPDATED}`,
    body: [
      ["개요", "본 사이트(Taskbar Hero Market, 이하 “당 사이트”)는 Steam 커뮤니티 마켓의 가격 분석 도구입니다. 계정 등록이나 로그인이 필요 없으며, 이름·이메일·비밀번호 등 개인정보를 수집하지 않습니다."],
      ["기기에 저장되는 정보", "언어, 구매/판매 모드, 테마(다크/라이트) 등 표시 설정을 사용자의 기기 쿠키 / localStorage에 저장하며, 설정 유지 목적으로만 사용합니다."],
      ["즐겨찾기·알림", "즐겨찾기나 가격 알림을 사용하는 경우 해당 데이터는 익명 세션 식별자에 연결되어 서버에 저장되며, 개인 신원과 연결되지 않습니다."],
      ["광고", "광고가 활성화된 경우 Google AdSense가 Google 정책에 따라 쿠키를 사용해 광고를 게재할 수 있습니다. 사용자는 Google 광고 설정에서 맞춤 광고를 해제할 수 있습니다. 광고가 비활성화된 동안에는 광고 쿠키나 스크립트가 로드되지 않습니다."],
      ["접속 분석", "분석이 활성화된 경우 쿠키를 사용하지 않고 개인을 식별하지 않는 프라이버시 친화적 분석 도구(예: Plausible)를 사용합니다."],
      ["데이터 판매 안 함", "당 사이트는 개인 식별 정보를 판매하지 않습니다."],
      ["문의", `본 방침에 대한 문의는 ${CONTACT} 로 연락 주십시오.`],
    ],
  },
  zh: {
    title: "隐私政策",
    updated: `最后更新: ${UPDATED}`,
    body: [
      ["概述", "本网站（Taskbar Hero Market，以下简称“本网站”）是 Steam 社区市场的价格分析工具。无需注册或登录，我们不收集姓名、电子邮件、密码等个人信息。"],
      ["存储在您设备上的信息", "语言、买卖模式、主题（深色/浅色）等显示设置存储在您设备的 Cookie / localStorage 中，仅用于保存您的设置。"],
      ["收藏与提醒", "如果您使用收藏或价格提醒，相关数据将以匿名会话标识符存储在我们的服务器上，不与您的个人身份关联。"],
      ["广告", "启用广告时，Google AdSense 可能会按照 Google 的政策使用 Cookie 投放广告。您可以通过 Google 广告设置关闭个性化广告。在关闭广告期间，不会加载任何广告 Cookie 或脚本。"],
      ["访问分析", "启用分析时，我们使用不依赖 Cookie、不识别个人身份的隐私友好型分析工具（例如 Plausible）。"],
      ["不出售数据", "本网站不出售可识别个人身份的信息。"],
      ["联系方式", `有关本政策的问题，请联系 ${CONTACT}。`],
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    updated: `Последнее обновление: ${UPDATED}`,
    body: [
      ["Обзор", "Taskbar Hero Market (далее «Сайт») — инструмент анализа цен Торговой площадки сообщества Steam. Регистрация и вход не требуются; мы не собираем личные данные, такие как имя, адрес электронной почты или пароль."],
      ["Хранится на вашем устройстве", "Настройки отображения (язык, режим покупки/продажи, тёмная/светлая тема) хранятся в cookie / localStorage на вашем устройстве исключительно для сохранения ваших настроек."],
      ["Избранное и уведомления", "Если вы используете избранное или ценовые уведомления, эти данные хранятся на нашем сервере под анонимным идентификатором сессии и не связаны с вашей личностью."],
      ["Реклама", "Когда реклама включена, Google AdSense может использовать cookie для показа объявлений в соответствии с политикой Google. Вы можете отключить персонализированную рекламу в настройках рекламы Google. Пока реклама отключена, рекламные cookie и скрипты не загружаются."],
      ["Аналитика", "Когда аналитика включена, мы используем конфиденциальный инструмент без cookie (например, Plausible), который не собирает данные, позволяющие установить личность."],
      ["Мы не продаём данные", "Мы не продаём данные, позволяющие установить личность."],
      ["Контакты", `По вопросам этой политики пишите на ${CONTACT}.`],
    ],
  },
  pt: {
    title: "Política de Privacidade",
    updated: `Última atualização: ${UPDATED}`,
    body: [
      ["Visão geral", "O Taskbar Hero Market (o “Site”) é uma ferramenta de análise do Mercado da Comunidade Steam. Não é necessário conta nem login, e não coletamos informações pessoais como nome, e-mail ou senha."],
      ["Armazenado no seu dispositivo", "Preferências de exibição (idioma, modo compra/venda, tema escuro/claro) são armazenadas em cookies / localStorage no seu dispositivo, apenas para lembrar suas configurações."],
      ["Favoritos e alertas", "Se você usar favoritos ou alertas de preço, esses dados são armazenados em nosso servidor sob um identificador de sessão anônimo e não são vinculados à sua identidade pessoal."],
      ["Publicidade", "Quando a publicidade está ativada, o Google AdSense pode usar cookies para exibir anúncios, de acordo com as políticas do Google. Você pode desativar anúncios personalizados nas Configurações de anúncios do Google. Enquanto os anúncios estão desativados, nenhum cookie ou script de anúncio é carregado."],
      ["Análise de acessos", "Quando a análise está ativada, usamos uma ferramenta de análise sem cookies e respeitosa da privacidade (por exemplo, Plausible) que não coleta informações de identificação pessoal."],
      ["Não vendemos dados", "Não vendemos informações de identificação pessoal."],
      ["Contato", `Para dúvidas sobre esta política, contate ${CONTACT}.`],
    ],
  },
  es: {
    title: "Política de Privacidad",
    updated: `Última actualización: ${UPDATED}`,
    body: [
      ["Resumen", "Taskbar Hero Market (el “Sitio”) es una herramienta de análisis del Mercado de la Comunidad de Steam. No se requiere cuenta ni inicio de sesión, y no recopilamos información personal como nombres, correos electrónicos o contraseñas."],
      ["Almacenado en tu dispositivo", "Las preferencias de visualización (idioma, modo compra/venta, tema oscuro/claro) se almacenan en cookies / localStorage de tu dispositivo, únicamente para recordar tu configuración."],
      ["Favoritos y alertas", "Si usas favoritos o alertas de precio, esos datos se almacenan en nuestro servidor bajo un identificador de sesión anónimo y no se vinculan a tu identidad personal."],
      ["Publicidad", "Cuando la publicidad está activada, Google AdSense puede usar cookies para mostrar anuncios, conforme a las políticas de Google. Puedes desactivar los anuncios personalizados en la Configuración de anuncios de Google. Mientras los anuncios están desactivados, no se cargan cookies ni scripts de anuncios."],
      ["Analítica", "Cuando la analítica está activada, usamos una herramienta de análisis respetuosa con la privacidad y sin cookies (por ejemplo, Plausible) que no recopila información de identificación personal."],
      ["No vendemos datos", "No vendemos información de identificación personal."],
      ["Contacto", `Para preguntas sobre esta política, contacta con ${CONTACT}.`],
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    updated: `Dernière mise à jour : ${UPDATED}`,
    body: [
      ["Aperçu", "Taskbar Hero Market (le « Site ») est un outil d’analyse du Marché communautaire Steam. Aucun compte ni connexion n’est requis, et nous ne collectons pas d’informations personnelles telles que nom, adresse e-mail ou mot de passe."],
      ["Stocké sur votre appareil", "Les préférences d’affichage (langue, mode achat/vente, thème sombre/clair) sont stockées dans des cookies / localStorage sur votre appareil, uniquement pour mémoriser vos réglages."],
      ["Favoris et alertes", "Si vous utilisez les favoris ou les alertes de prix, ces données sont stockées sur notre serveur sous un identifiant de session anonyme et ne sont pas liées à votre identité."],
      ["Publicité", "Lorsque la publicité est activée, Google AdSense peut utiliser des cookies pour diffuser des annonces, conformément aux politiques de Google. Vous pouvez désactiver les annonces personnalisées dans les paramètres des annonces Google. Lorsque la publicité est désactivée, aucun cookie ni script publicitaire n’est chargé."],
      ["Analyse d’audience", "Lorsque l’analyse est activée, nous utilisons un outil d’analyse sans cookie et respectueux de la vie privée (par ex. Plausible) qui ne collecte aucune information personnelle identifiable."],
      ["Pas de vente de données", "Nous ne vendons aucune information personnelle identifiable."],
      ["Contact", `Pour toute question sur cette politique, contactez ${CONTACT}.`],
    ],
  },
  de: {
    title: "Datenschutzerklärung",
    updated: `Zuletzt aktualisiert: ${UPDATED}`,
    body: [
      ["Überblick", "Taskbar Hero Market (die „Website“) ist ein Analysetool für den Steam-Community-Markt. Es sind kein Konto und keine Anmeldung erforderlich, und wir erheben keine personenbezogenen Daten wie Namen, E-Mail-Adressen oder Passwörter."],
      ["Auf Ihrem Gerät gespeichert", "Anzeigeeinstellungen (Sprache, Kauf-/Verkaufsmodus, dunkles/helles Design) werden in Cookies / localStorage auf Ihrem Gerät gespeichert, ausschließlich um Ihre Einstellungen zu merken."],
      ["Favoriten & Benachrichtigungen", "Wenn Sie Favoriten oder Preisalarme nutzen, werden diese Daten auf unserem Server unter einer anonymen Sitzungskennung gespeichert und nicht mit Ihrer persönlichen Identität verknüpft."],
      ["Werbung", "Wenn Werbung aktiviert ist, kann Google AdSense gemäß den Richtlinien von Google Cookies zur Auslieferung von Anzeigen verwenden. Sie können personalisierte Werbung in den Google-Anzeigeneinstellungen deaktivieren. Solange Werbung deaktiviert ist, werden keine Werbe-Cookies oder -Skripte geladen."],
      ["Zugriffsanalyse", "Wenn die Analyse aktiviert ist, verwenden wir ein datenschutzfreundliches, cookieloses Analysetool (z. B. Plausible), das keine personenbezogenen Daten erhebt."],
      ["Kein Datenverkauf", "Wir verkaufen keine personenbezogenen Daten."],
      ["Kontakt", `Bei Fragen zu dieser Richtlinie wenden Sie sich an ${CONTACT}.`],
    ],
  },
};

export default async function PrivacyPage() {
  const locale = (await getLocale()) as Locale;
  const c = CONTENT[locale] ?? CONTENT.en;
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
