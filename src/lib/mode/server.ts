import "server-only";
import { cookies } from "next/headers";
import { isMode, DEFAULT_MODE, MODE_COOKIE, type Mode } from "./index";

/** サーバコンポーネント用: cookie から購入/販売モードを解決。 */
export async function getMode(): Promise<Mode> {
  const c = await cookies();
  const v = c.get(MODE_COOKIE)?.value;
  return isMode(v) ? v : DEFAULT_MODE;
}
