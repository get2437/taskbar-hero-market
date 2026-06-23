import { NextRequest, NextResponse } from "next/server";

/**
 * APIレート制限 (Edge / in-memory)。
 * 単一インスタンス前提。複数インスタンス構成では共有ストア(Redis/Upstash)へ移行すること。
 * ルート種別ごとに上限を変える:
 *   - /api/items/.../orderbook : Steamを叩くため厳しめ
 *   - /api/live (SSE)          : 再接続スパム防止
 *   - /api/admin/*             : 管理操作
 *   - その他 /api/*            : 既定
 */
interface Bucket {
  count: number;
  reset: number;
}
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  // 期限切れの掃除 (60秒毎)
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function ruleFor(pathname: string): { group: string; max: number; windowMs: number } {
  if (pathname.includes("/orderbook")) return { group: "ob", max: 30, windowMs: 60_000 };
  if (pathname === "/api/live") return { group: "live", max: 20, windowMs: 60_000 };
  if (pathname.startsWith("/api/admin")) return { group: "admin", max: 30, windowMs: 60_000 };
  return { group: "api", max: 120, windowMs: 60_000 };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { group, max, windowMs } = ruleFor(pathname);
  const ip = clientIp(req);
  if (!allow(`${ip}:${group}`, max, windowMs)) {
    return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(windowMs / 1000)),
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
