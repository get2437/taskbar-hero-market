import { NextRequest, NextResponse } from "next/server";
import { invalidate } from "@/lib/redis";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let removed = 0;
  for (const prefix of ["dashboard", "ranking:", "items:", "history:"]) {
    removed += await invalidate(prefix);
  }
  return NextResponse.json({ ok: true, removed });
}
