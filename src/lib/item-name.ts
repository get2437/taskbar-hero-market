export type NameI18n = Record<string, string> | null | undefined;

/** 表示名(翻訳優先)と、翻訳がある場合の英語原文を返す。サーバ/クライアント共用(副作用なし)。 */
export function resolveItemName(
  name: string,
  nameI18n: NameI18n,
  locale: string,
): { display: string; original: string | null } {
  const tr = nameI18n && locale !== "en" ? nameI18n[locale] : null;
  return { display: tr || name, original: tr && tr !== name ? name : null };
}
