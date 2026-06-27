import { steamFetch } from "./src/lib/steam/http";
import { parseListingDescription } from "./src/lib/steam/descriptions";
import statI18n from "./assets/stat-i18n.json";

const KNOWN = new Set(Object.keys((statI18n as any).stats));
const H = { Cookie: "Steam_Language=english" };

async function main() {
  // 全アイテム名を収集 (検索は10件/ページ)
  const names: string[] = [];
  let start = 0;
  while (start < 1000) {
    const r = await steamFetch(`https://steamcommunity.com/market/search/render/?appid=3678970&norender=1&count=100&start=${start}&sort_column=popular`, { retries: 3 });
    const d = await r.json();
    const res = d?.results ?? [];
    if (!res.length) break;
    for (const x of res) names.push(x.hash_name);
    const total = d?.total_count ?? 0;
    start += res.length;
    if (start >= total) break;
    await new Promise((r) => setTimeout(r, 1300));
  }
  // ベース名でユニーク化 (レア度/接尾辞違いは同じステータス構成)
  const byBase = new Map<string, string>();
  for (const n of names) {
    const base = n.replace(/\s*\([^)]+\).*$/, "").trim();
    if (!byBase.has(base)) byBase.set(base, n);
  }
  const sample = [...byBase.values()];
  console.log(`names=${names.length} unique-base=${sample.length}; crawling...`);

  const missing = new Map<string, string>();
  let done = 0;
  for (const n of sample) {
    try {
      const html = await (await steamFetch(`https://steamcommunity.com/market/listings/3678970/${encodeURIComponent(n)}`, { retries: 2, headers: H })).text();
      const d = parseListingDescription(html);
      for (const s of [...d.baseStats, ...d.inherentStats, ...d.materialEffects]) {
        if (!KNOWN.has(s.key)) missing.set(s.key, s.label);
      }
    } catch {}
    done++;
    if (done % 25 === 0) console.log(`  crawled ${done}/${sample.length} (missing so far: ${missing.size})`);
    await new Promise((r) => setTimeout(r, 1300));
  }
  console.log("\n=== MISSING stat keys ===");
  for (const [k, label] of [...missing].sort()) console.log(`${k}\t${label}`);
  console.log("TOTAL_MISSING:", missing.size);
}
main();
