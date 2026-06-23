import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * クライアント側 Error Boundary からの報告受け口。
 * 秘匿情報 (DSN/Webhook) はサーバにのみ置き、ここで監視へ転送する。
 * middleware の api レート制限 (120 req/min/IP) の対象。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      message?: string;
      stack?: string;
      digest?: string;
      url?: string;
      source?: string;
    };

    const err = new Error(String(body.message ?? "client error").slice(0, 500));
    err.name = "ClientError";
    if (typeof body.stack === "string") err.stack = body.stack.slice(0, 4000);

    captureException(err, {
      source: body.source ?? "client-boundary",
      level: "error",
      extra: { digest: body.digest, url: body.url, ua: req.headers.get("user-agent") },
    });
  } catch {
    /* 報告自体の失敗は無視 (204を返す) */
  }
  return new NextResponse(null, { status: 204 });
}
