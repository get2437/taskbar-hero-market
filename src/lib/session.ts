import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * 認証は本MVPの対象外。代わりに「匿名セッション」で一人ひとりを区別する。
 * ミドルウェアが訪問者ごとに固有の uid クッキーを発行し、その uid を email 代わり(anon:<uid>)に
 * した User を現在ユーザーとして扱う。これによりお気に入り/フォルダ/アラートが他人と混ざらない。
 * 将来 NextAuth 等へ差し替える際はこの関数だけ変更すればよい。
 */
const DEMO_EMAIL = "demo@taskbar-hero.local";

async function emailForRequest(): Promise<string> {
  const uid = (await cookies()).get("uid")?.value;
  // uid はミドルウェアが必ず発行する。万一無い経路では従来のデモユーザーにフォールバック。
  return uid ? `anon:${uid}` : DEMO_EMAIL;
}

export async function getCurrentUser() {
  const email = await emailForRequest();
  // 既存ユーザーは読み取りのみ (毎リクエストの書き込みを避ける)。初回だけ作成。
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.upsert({
    where: { email },
    create: { email, name: email === DEMO_EMAIL ? "Demo Trader" : "Anonymous" },
    update: {},
  });
}

export async function getCurrentUserId(): Promise<string> {
  const u = await getCurrentUser();
  return u.id;
}
