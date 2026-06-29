import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Disclaimer", robots: { index: true, follow: true } };

// ⚠️ 公開前に内容を確認・調整してください（雛形）。
type Content = { title: string; updated: string; body: [string, string][] };
const UPDATED = "2026-06-16";

const CONTENT: Partial<Record<Locale, Content>> & { en: Content } = {
  en: {
    title: "Disclaimer",
    updated: `Last updated: ${UPDATED}`,
    body: [
      ["Not financial advice", "Prices, investment scores, forecasts and analysis on this Site are for informational purposes only and are not financial or investment advice. They are heuristic estimates and do not guarantee future prices or profits. Any trading decisions are made at your own risk."],
      ["Accuracy of data", "Market data is sourced from Steam and may be delayed, incomplete, or inaccurate. We make no warranty as to the accuracy, completeness, or availability of the data."],
      ["Limitation of liability", "We are not liable for any losses or damages arising from use of this Site. Use at your own risk."],
      ["Trademarks", "This is an unofficial tool, not affiliated with or endorsed by Valve Corporation. Steam and the Steam logo are trademarks of Valve. Game and item names belong to their respective owners."],
      ["Steam terms", "Actual trading on the Steam Market is governed by Steam’s (Valve’s) own terms of service."],
    ],
  },
  ja: {
    title: "免責事項",
    updated: `最終更新: ${UPDATED}`,
    body: [
      ["投資助言ではありません", "当サイトの価格・投資スコア・予測・分析コメントは情報提供のみを目的とし、投資助言ではありません。これらはヒューリスティックな推定値であり、将来の価格や利益を保証するものではありません。売買の判断はご自身の責任で行ってください。"],
      ["データの正確性", "マーケットデータは Steam から取得しており、遅延・欠落・誤りが含まれる可能性があります。当サイトはデータの正確性・完全性・可用性を保証しません。"],
      ["免責", "当サイトの利用によって生じたいかなる損害についても、当サイトは責任を負いません。ご利用は自己責任でお願いします。"],
      ["商標", "当サイトは非公式ツールであり、Valve Corporation との提携・公認はありません。Steam および Steam ロゴは Valve の商標です。ゲーム名・アイテム名は各権利者に帰属します。"],
      ["Steam の規約", "Steam マーケットでの実際の取引は、Steam（Valve）自身の利用規約に従います。"],
    ],
  },
  ko: {
    title: "면책 조항",
    updated: `최종 업데이트: ${UPDATED}`,
    body: [
      ["투자 조언이 아닙니다", "본 사이트의 가격·투자 점수·예측·분석 코멘트는 정보 제공만을 목적으로 하며 투자 조언이 아닙니다. 이는 휴리스틱 추정치이며 미래의 가격이나 수익을 보장하지 않습니다. 매매 결정은 본인 책임으로 하시기 바랍니다."],
      ["데이터의 정확성", "마켓 데이터는 Steam에서 수집되며 지연·누락·오류가 포함될 수 있습니다. 본 사이트는 데이터의 정확성·완전성·가용성을 보장하지 않습니다."],
      ["책임의 제한", "본 사이트 이용으로 발생한 어떠한 손해에 대해서도 본 사이트는 책임지지 않습니다. 이용은 본인 책임입니다."],
      ["상표", "본 사이트는 비공식 도구이며 Valve Corporation과 제휴하거나 승인받지 않았습니다. Steam 및 Steam 로고는 Valve의 상표입니다. 게임명·아이템명은 각 권리자에게 귀속됩니다."],
      ["Steam 약관", "Steam 마켓에서의 실제 거래는 Steam(Valve) 자체의 이용 약관을 따릅니다."],
    ],
  },
  zh: {
    title: "免责声明",
    updated: `最后更新: ${UPDATED}`,
    body: [
      ["非投资建议", "本网站的价格、投资评分、预测和分析评论仅供参考，并非财务或投资建议。它们是启发式估算，不保证未来的价格或收益。任何交易决策均由您自行承担风险。"],
      ["数据准确性", "市场数据来自 Steam，可能存在延迟、缺失或错误。本网站不保证数据的准确性、完整性或可用性。"],
      ["责任限制", "对于因使用本网站而产生的任何损失或损害，本网站概不负责。使用风险自负。"],
      ["商标", "本网站为非官方工具，与 Valve Corporation 无关联，也未获其认可。Steam 及 Steam 标志是 Valve 的商标。游戏和物品名称归各自所有者所有。"],
      ["Steam 条款", "在 Steam 市场上的实际交易受 Steam（Valve）自身的服务条款约束。"],
    ],
  },
  ru: {
    title: "Отказ от ответственности",
    updated: `Последнее обновление: ${UPDATED}`,
    body: [
      ["Не финансовый совет", "Цены, инвестиционные оценки, прогнозы и аналитика на этом Сайте предоставлены только для информации и не являются финансовым или инвестиционным советом. Это эвристические оценки, которые не гарантируют будущих цен или прибыли. Любые торговые решения вы принимаете на свой риск."],
      ["Точность данных", "Рыночные данные получены из Steam и могут быть устаревшими, неполными или неточными. Мы не гарантируем точность, полноту или доступность данных."],
      ["Ограничение ответственности", "Мы не несём ответственности за любые убытки или ущерб, возникшие в результате использования Сайта. Используйте на свой риск."],
      ["Товарные знаки", "Это неофициальный инструмент, не связанный с Valve Corporation и не одобренный ею. Steam и логотип Steam являются товарными знаками Valve. Названия игр и предметов принадлежат их правообладателям."],
      ["Условия Steam", "Фактическая торговля на Торговой площадке Steam регулируется собственными условиями использования Steam (Valve)."],
    ],
  },
  pt: {
    title: "Aviso legal",
    updated: `Última atualização: ${UPDATED}`,
    body: [
      ["Não é aconselhamento financeiro", "Preços, pontuações de investimento, previsões e análises neste Site são apenas para fins informativos e não constituem aconselhamento financeiro ou de investimento. São estimativas heurísticas e não garantem preços ou lucros futuros. Qualquer decisão de negociação é feita por sua conta e risco."],
      ["Exatidão dos dados", "Os dados de mercado vêm da Steam e podem estar atrasados, incompletos ou incorretos. Não garantimos a exatidão, integridade ou disponibilidade dos dados."],
      ["Limitação de responsabilidade", "Não nos responsabilizamos por quaisquer perdas ou danos decorrentes do uso deste Site. Use por sua conta e risco."],
      ["Marcas registradas", "Esta é uma ferramenta não oficial, sem afiliação ou endosso da Valve Corporation. Steam e o logotipo da Steam são marcas registradas da Valve. Os nomes de jogos e itens pertencem aos seus respectivos proprietários."],
      ["Termos da Steam", "As negociações reais no Mercado Steam são regidas pelos termos de serviço da própria Steam (Valve)."],
    ],
  },
  es: {
    title: "Aviso legal",
    updated: `Última actualización: ${UPDATED}`,
    body: [
      ["No es asesoramiento financiero", "Los precios, puntuaciones de inversión, previsiones y análisis de este Sitio son solo para fines informativos y no constituyen asesoramiento financiero o de inversión. Son estimaciones heurísticas y no garantizan precios ni beneficios futuros. Cualquier decisión de compraventa es bajo su propia responsabilidad."],
      ["Exactitud de los datos", "Los datos de mercado provienen de Steam y pueden estar retrasados, incompletos o ser inexactos. No garantizamos la exactitud, integridad ni disponibilidad de los datos."],
      ["Limitación de responsabilidad", "No nos hacemos responsables de ninguna pérdida o daño derivado del uso de este Sitio. Úselo bajo su propia responsabilidad."],
      ["Marcas registradas", "Esta es una herramienta no oficial, sin afiliación ni respaldo de Valve Corporation. Steam y el logotipo de Steam son marcas registradas de Valve. Los nombres de juegos y objetos pertenecen a sus respectivos propietarios."],
      ["Términos de Steam", "Las transacciones reales en el Mercado de Steam se rigen por los términos de servicio de la propia Steam (Valve)."],
    ],
  },
  fr: {
    title: "Avertissement",
    updated: `Dernière mise à jour : ${UPDATED}`,
    body: [
      ["Pas un conseil financier", "Les prix, scores d’investissement, prévisions et analyses de ce Site sont fournis à titre informatif uniquement et ne constituent pas un conseil financier ou en investissement. Ce sont des estimations heuristiques qui ne garantissent ni prix ni profits futurs. Toute décision de transaction est prise à vos propres risques."],
      ["Exactitude des données", "Les données de marché proviennent de Steam et peuvent être retardées, incomplètes ou inexactes. Nous ne garantissons pas l’exactitude, l’exhaustivité ni la disponibilité des données."],
      ["Limitation de responsabilité", "Nous déclinons toute responsabilité pour toute perte ou tout dommage résultant de l’utilisation de ce Site. Utilisation à vos propres risques."],
      ["Marques", "Ceci est un outil non officiel, sans affiliation ni approbation de Valve Corporation. Steam et le logo Steam sont des marques de Valve. Les noms de jeux et d’objets appartiennent à leurs propriétaires respectifs."],
      ["Conditions de Steam", "Les transactions réelles sur le Marché Steam sont régies par les conditions d’utilisation propres à Steam (Valve)."],
    ],
  },
  de: {
    title: "Haftungsausschluss",
    updated: `Zuletzt aktualisiert: ${UPDATED}`,
    body: [
      ["Keine Anlageberatung", "Preise, Investitions-Scores, Prognosen und Analysen auf dieser Website dienen nur zu Informationszwecken und stellen keine Finanz- oder Anlageberatung dar. Es handelt sich um heuristische Schätzungen, die keine zukünftigen Preise oder Gewinne garantieren. Handelsentscheidungen treffen Sie auf eigenes Risiko."],
      ["Datengenauigkeit", "Marktdaten stammen von Steam und können verzögert, unvollständig oder fehlerhaft sein. Wir übernehmen keine Gewähr für Richtigkeit, Vollständigkeit oder Verfügbarkeit der Daten."],
      ["Haftungsbeschränkung", "Wir haften nicht für Verluste oder Schäden, die aus der Nutzung dieser Website entstehen. Nutzung auf eigenes Risiko."],
      ["Marken", "Dies ist ein inoffizielles Tool, das weder mit Valve Corporation verbunden noch von ihr unterstützt wird. Steam und das Steam-Logo sind Marken von Valve. Spiel- und Gegenstandsnamen gehören ihren jeweiligen Eigentümern."],
      ["Steam-Bedingungen", "Der tatsächliche Handel auf dem Steam-Markt unterliegt den Nutzungsbedingungen von Steam (Valve) selbst."],
    ],
  },
};

export default async function DisclaimerPage() {
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
