// 各ファセットタグを絞り込み検索で総当たりし、アイテム hash -> 実タグ(type/grade/part/cls/level) を構築。
// assets/tags.json に保存する。
import fs from "node:fs";

const APP = 3678970;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// facet名 -> demoのフィールド名
const FACET_FIELD = { type: "type", rarity: "grade", parts: "part", class: "cls", level: "level" };

const filters = JSON.parse(fs.readFileSync("assets/appfilters.json", "utf8"));

async function getJson(url, tries = 0) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (r.status === 429 && tries < 5) { await sleep(5000 * (tries + 1)); return getJson(url, tries + 1); }
    if (!r.ok) return null;
    return await r.json();
  } catch { if (tries < 3) { await sleep(3000); return getJson(url, tries + 1); } return null; }
}

const map = {}; // hash -> { type, grade, part, cls, level }
function assign(hash, field, value) {
  if (!map[hash]) map[hash] = {};
  map[hash][field] = value;
}

async function run() {
  let reqs = 0;
  for (const [facetKey, facet] of Object.entries(filters.facets)) {
    const facetName = facet.name; // type / rarity / parts / class / level
    const field = FACET_FIELD[facetName];
    if (!field) continue;
    for (const [tagId] of Object.entries(facet.tags)) {
      let start = 0, total = Infinity, seen = 0;
      while (start < total) {
        const url = `https://steamcommunity.com/market/search/render/?appid=${APP}&norender=1&count=100&start=${start}&sort_column=name&category_${APP}_${facetName}%5B%5D=tag_${encodeURIComponent(tagId)}`;
        const d = await getJson(url);
        reqs++;
        if (!d || !d.results) break;
        total = d.total_count;
        for (const r of d.results) assign(r.hash_name, field, facetName === "level" ? Number(tagId) : tagId);
        seen += d.results.length;
        start += 10;
        process.stdout.write(`\r[${facetName}=${tagId}] ${seen}/${total}  reqs=${reqs}  items=${Object.keys(map).length}   `);
        if (d.results.length === 0) break;
        await sleep(1300);
      }
    }
    fs.writeFileSync("assets/tags.json", JSON.stringify(map)); // facet毎に途中保存
  }
  fs.writeFileSync("assets/tags.json", JSON.stringify(map));
  const full = Object.values(map).filter((v) => v.type && v.grade).length;
  console.log(`\nDONE. tagged hashes=${Object.keys(map).length}, reqs=${reqs}, with type+grade=${full}`);
}
run();
