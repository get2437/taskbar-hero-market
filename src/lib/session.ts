import { prisma } from "@/lib/prisma";

/**
 * 認証は本MVPの対象外。仕様の「ログインユーザー向け」機能を動かすため、
 * 単一のデモユーザーを現在ユーザーとして扱う。
 * 将来 NextAuth 等へ差し替える際はこの関数だけ変更すればよい。
 */
const DEMO_EMAIL = "demo@taskbar-hero.local";

export async function getCurrentUser() {
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: { email: DEMO_EMAIL, name: "Demo Trader" },
    update: {},
  });
}

export async function getCurrentUserId(): Promise<string> {
  const u = await getCurrentUser();
  return u.id;
}
