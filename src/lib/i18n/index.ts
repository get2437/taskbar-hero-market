import { messages, facetMessages, LOCALES, type Locale } from "./messages";
import statI18n from "../../../assets/stat-i18n.json";
import i18nExtra from "../../../assets/i18n-extra.json";

export { LOCALES, DEFAULT_LOCALE, LOCALE_LABEL } from "./messages";
export type { Locale } from "./messages";

export const LOCALE_COOKIE = "locale";

// 機械翻訳で生成した追加翻訳 (scripts/translate-ui.ts が assets/i18n-extra.json を生成)。
// 手書き辞書(messages/stat-i18n)に無い言語をこれで補い、最終的に英語へフォールバック。
const EX = i18nExtra as {
  t?: Record<string, Record<string, string>>;
  f?: Record<string, Record<string, string>>;
  s?: Record<string, Record<string, string>>;
  su?: Record<string, Record<string, string>>;
  sq?: Record<string, Record<string, string>>;
};

// 説明文由来のステータス名・見出し辞書 (assets/stat-i18n.json と共有)。
type LMap = Partial<Record<Locale, string>> & { en: string; g?: string };
const SI = statI18n as {
  ui: Record<string, LMap>;
  stats: Record<string, LMap>;
  unique: Record<string, LMap>;
  groupOrder?: string[];
};

/** フィルタチップ用: stat-i18n.json に定義のあるステータスキー一覧。 */
export const STAT_KEYS: string[] = Object.keys(SI.stats);

/** ステータスのグループ分け (offense/defense/resist/sustain)。チップのグループ表示用。 */
export const STAT_GROUP_ORDER: string[] = SI.groupOrder ?? [];
export const STAT_GROUP_OF: Record<string, string> = Object.fromEntries(
  Object.entries(SI.stats).map(([k, v]) => [k, v.g ?? "other"]),
);
/** グループ名 -> su() 用キー (offense -> groupOffense)。 */
export function statGroupLabelKey(group: string): string {
  return "group" + group.charAt(0).toUpperCase() + group.slice(1);
}

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export interface Translator {
  locale: Locale;
  /** UIメッセージ */
  t: (id: string) => string;
  /** ファセット値 (GEAR, KNIGHT, IMMORTAL ...) */
  f: (value: string) => string;
  /** ステータス名 (critical_damage ...)。未知キーは fallback または key を返す。 */
  s: (key: string, fallback?: string) => string;
  /** ステータス系UI見出し (stats, baseStats, materialType ...)。 */
  su: (key: string) => string;
  /** 特殊ステータスの効果文 (キー=文のスラッグ)。 */
  sq: (key: string, fallback?: string) => string;
}

export function createTranslator(locale: Locale): Translator {
  // 解決順: 手書き辞書(locale) → 機械翻訳の追加(locale) → 英語 → fallback/キー
  return {
    locale,
    t: (id) => messages[id]?.[locale] ?? EX.t?.[locale]?.[id] ?? messages[id]?.en ?? id,
    f: (value) => facetMessages[value]?.[locale] ?? EX.f?.[locale]?.[value] ?? facetMessages[value]?.en ?? value,
    s: (key, fallback) => SI.stats[key]?.[locale] ?? EX.s?.[locale]?.[key] ?? SI.stats[key]?.en ?? fallback ?? key,
    su: (key) => SI.ui[key]?.[locale] ?? EX.su?.[locale]?.[key] ?? SI.ui[key]?.en ?? key,
    sq: (key, fallback) => SI.unique[key]?.[locale] ?? EX.sq?.[locale]?.[key] ?? SI.unique[key]?.en ?? fallback ?? key,
  };
}
