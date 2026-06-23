import { NextRequest, NextResponse } from "next/server";
import { runRefresh } from "@/lib/jobs";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const doFetch = req.nextUrl.searchParams.get("fetch") !== "false";
  try {
    const result = await runRefresh({ fetch: doFetch });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
