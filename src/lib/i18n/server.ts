import "server-only";
import { cookies } from "next/headers";
import { createTranslator, isLocale, LOCALE_COOKIE, type Translator } from "./index";
import { DEFAULT_LOCALE, type Locale } from "./messages";

/** サーバコンポーネント用: cookie からロケールを解決。 */
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** サーバコンポーネント用: トランスレータを取得。 */
export async function getTranslator(): Promise<Translator> {
  return createTranslator(await getLocale());
}
