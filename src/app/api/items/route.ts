import { NextRequest, NextResponse } from "next/server";
import { listItems, type ItemListParams } from "@/lib/queries";
import { cached } from "@/lib/redis";

export const dynamic = "force-dynamic";

function nums(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function csv(v: string | null): string[] | undefined {
  if (!v) return undefined;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params: ItemListParams = {
    q: sp.get("q") ?? undefined,
    priceMin: nums(sp.get("priceMin")),
    priceMax: nums(sp.get("priceMax")),
    types: csv(sp.get("types")),
    parts: csv(sp.get("parts")),
    grades: csv(sp.get("grades")),
    classes: csv(sp.get("classes")),
    levelMin: nums(sp.get("levelMin")),
    levelMax: nums(sp.get("levelMax")),
    matCategories: csv(sp.get("matCategories")),
    reqLevelMin: nums(sp.get("reqLevelMin")),
    reqLevelMax: nums(sp.get("reqLevelMax")),
    statKeys: csv(sp.get("statKeys")),
    statKind: sp.get("statKind") ?? undefined,
    withUnique: sp.get("withUnique") === "1" || sp.get("withUnique") === "true",
    sort: (sp.get("sort") as ItemListParams["sort"]) ?? undefined,
    order: (sp.get("order") as ItemListParams["order"]) ?? undefined,
    page: nums(sp.get("page")),
    pageSize: nums(sp.get("pageSize")),
  };

  const key = `items:${JSON.stringify(params)}`;
  const data = await cached(key, 30, () => listItems(params));
  return NextResponse.json(data);
}
