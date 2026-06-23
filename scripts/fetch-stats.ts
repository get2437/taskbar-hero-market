/**
 * 全マーケットアイテムのリスティングページを巡回し、説明文を構造化して
 * assets/stats.json に保存する。デモ生成・本番 seed の素材。
 *
 *   npx tsx scripts/fetch-stats.ts            … assets/market.json の全件
 *   npx tsx scripts/fetch-stats.ts --limit 5  … 先頭5件だけ(検証用)
 *   npx tsx scripts/fetch-stats.ts "Wood" "Minor Amethyst"  … 指定名のみ
 *
 * リスティングページはレート制限が厳しいので STEAM_REQUEST_INTERVAL_MS 間隔で逐次取得する。
 */
import fs from "node:fs";
import { fetchItemDescription, type ParsedDescription } from "../src/lib/steam/descriptions";

const APP_ID = Number(process.env.STEAM_APP_ID ?? 3678970);
const INTERVAL = Number(process.env.STEAM_REQUEST_INTERVAL_MS ?? 3500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(name: string): Promise<ParsedDescription | null> {
  const parsed = await fetchItemDescription(name, APP_ID);
  if (!parsed) console.warn(`  ! ${name}: no description`);
  return parsed;
}

function targetNames(): string[] {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  let limit = Infinity;
  if (limitIdx >= 0) {
    limit = Number(args[limitIdx + 1]) || Infinity;
    args.splice(limitIdx, 2);
  }
  const mergeIdx = args.indexOf("--merge");
  if (mergeIdx >= 0) args.splice(mergeIdx, 1); // フラグ除去 (main 側で参照)

  if (args.length) return args; // 明示指定

  const market: { name: string; hash: string }[] = JSON.parse(fs.readFileSync("assets/market.json", "utf8"));
  return market.map((m) => m.hash ?? m.name).slice(0, limit);
}

async function main() {
  const merge = process.argv.includes("--merge");
  const names = targetNames();
  console.log(`[stats] fetching ${names.length} items (interval ${INTERVAL}ms)${merge ? " [merge]" : ""}...`);

  // --merge: 既存 stats.json を読み込んで指定キーだけ上書きする
  const out: Record<string, ParsedDescription> =
    merge && fs.existsSync("assets/stats.json")
      ? JSON.parse(fs.readFileSync("assets/stats.json", "utf8"))
      : {};
  let ok = 0;
  let withStats = 0;
  let withUnique = 0;

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const parsed = await fetchOne(name);
      if (parsed) {
        out[name] = parsed;
        ok++;
        if (parsed.baseStats.length || parsed.inherentStats.length || parsed.materialEffects.length) withStats++;
        if (parsed.uniqueStats.length) withUnique++;
      }
    } catch (e) {
      console.warn(`  ! ${name}: ${(e as Error).message}`);
    }
    if ((i + 1) % 10 === 0) {
      console.log(`  ...${i + 1}/${names.length} (ok=${ok})`);
      fs.writeFileSync("assets/stats.json", JSON.stringify(out, null, 1)); // 途中保存
    }
    if (i < names.length - 1) await sleep(INTERVAL);
  }

  fs.writeFileSync("assets/stats.json", JSON.stringify(out, null, 1));
  console.log(`[stats] done. ok=${ok}/${names.length}, withStats=${withStats}, withUnique=${withUnique}`);
  console.log(`[stats] saved -> assets/stats.json`);
}

main().catch((e) => {
  console.error("[stats] failed:", e);
  process.exit(1);
});
