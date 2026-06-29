import "server-only";
import { cookies, headers } from "next/headers";
import { createTranslator, isLocale, LOCALE_COOKIE, type Translator } from "./index";
import { DEFAULT_LOCALE, type Locale } from "./messages";

/**
 * サーバコンポーネント用: ロケールを解決する。
 * 1) ユーザーが選んだ locale クッキーがあれば最優先。
 * 2) 無ければブラウザの Accept-Language から対応言語を自動判定。
 * 3) どれも該当しなければ英語。
 */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(v)) return v;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase(); // 例: "ja-jp" / "pt-br"
    if (isLocale(tag)) return tag;
    const base = tag.split("-")[0]; // 言語サブタグ (zh-tw -> zh, pt-br -> pt)
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** サーバコンポーネント用: トランスレータを取得。 */
export async function getTranslator(): Promise<Translator> {
  return createTranslator(await getLocale());
}
