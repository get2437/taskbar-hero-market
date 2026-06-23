import { timingSafeEqual } from "node:crypto";

/**
 * 管理APIの認可。
 * - 本番(NODE_ENV=production)で ADMIN_TOKEN 未設定なら「拒否」(fail closed)
 * - 開発では未設定を許可
 * - 比較はタイミング攻撃を避けるため timingSafeEqual
 */
export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return process.env.NODE_ENV !== "production";
  const provided = req.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
