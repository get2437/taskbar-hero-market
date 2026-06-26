export type NameI18n = Record<string, string> | null | undefined;

/** 機械翻訳された効果文(labelI18n)があれば locale の訳を、無ければ fallback を返す。 */
export function resolveStatLabel(labelI18n: NameI18n, locale: string, fallback: string): string {
  return (labelI18n && locale !== "en" && labelI18n[locale]) || fallback;
}

/** 表示名(翻訳優先)と、翻訳がある場合の英語原文を返す。サーバ/クライアント共用(副作用なし)。 */
export function resolveItemName(
  name: string,
  nameI18n: NameI18n,
  locale: string,
): { display: string; original: string | null } {
  const tr = nameI18n && locale !== "en" ? nameI18n[locale] : null;
  return { display: tr || name, original: tr && tr !== name ? name : null };
}
