/**
 * E1-E6: assets data integrity verification.
 * Run: npx tsx scripts/verify/data.test.ts
 *
 * stats.json(136) / market.json / tags.json / stat-i18n.json を突合する。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { statKey } from "../../src/lib/steam/descriptions";

const ROOT = resolve(__dirname, "../..");
const load = (p: string) => JSON.parse(readFileSync(resolve(ROOT, "assets", p), "utf8"));

let pass = 0,
  fail = 0,
  warn = 0;
const fails: string[] = [];
function check(id: string, cond: boolean, msg: string) {
  if (cond) pass++;
  else {
    fail++;
    fails.push(`[${id}] ${msg}`);
    console.error(`  FAIL [${id}] ${msg}`);
  }
}
function note(id: string, msg: string) {
  warn++;
  console.warn(`  WARN [${id}] ${msg}`);
}

const stats = load("stats.json") as Record<string, any>;
const market = load("market.json") as any[];
const statI18n = load("stat-i18n.json") as any;

// ---- E1: stats.json 136件・JSON妥当 -------------------------------------
const statHashes = Object.keys(stats);
check("E1", statHashes.length === 136, `stats.json 136 entries got ${statHashes.length}`);
check("E1", statHashes.every((h) => typeof stats[h] === "object"), `all stats entries are objects`);

// ---- E2: market.json (unique hash) ⊂ stats.json -------------------------
const marketHashes = [...new Set(market.map((m) => m.hash))];
check("E2", market.length > 0, `market.json non-empty (${market.length} rows)`);
const missingStats = marketHashes.filter((h) => !(h in stats));
check("E2", missingStats.length === 0, `${missingStats.length}/${marketHashes.length} market items missing in stats.json${missingStats.length ? " e.g. " + missingStats.slice(0, 8).join(", ") : ""}`);

// ---- E3: 装備(gear)に baseStats∪inherentStats あり ----------------------
// gear = materialCategory が NONE/null かつ何らかの装備属性。素材は materialCategory が付く。
const MAT_CATS = new Set(["DECORATION", "ENGRAVING", "INSCRIPTION", "CRAFTING", "SOULSTONE"]);
let gearCount = 0,
  gearNoStats = 0;
const gearNoStatsList: string[] = [];
for (const [h, d] of Object.entries(stats)) {
  const isMaterial = d.materialCategory && MAT_CATS.has(d.materialCategory);
  // gear 判定: 素材カテゴリでない & スロット or requiredLevel or grade を持つ装備っぽいもの
  const looksGear = !isMaterial && (d.requiredLevel != null || d.slots?.decoration != null || d.slots?.engraving != null || d.slots?.inscription != null || (d.baseStats?.length || d.inherentStats?.length || d.uniqueStats?.length));
  if (looksGear) {
    gearCount++;
    const hasStats = (d.baseStats?.length || 0) + (d.inherentStats?.length || 0) > 0;
    if (!hasStats) {
      gearNoStats++;
      if (gearNoStatsList.length < 12) gearNoStatsList.push(h);
    }
  }
}
console.log(`  gear-like items: ${gearCount}`);
check("E3", gearNoStats === 0, `gear items lacking base∪inherent stats: ${gearNoStats}${gearNoStatsList.length ? " e.g. " + gearNoStatsList.join(", ") : ""}`);

// ---- E4: 素材カテゴリ網羅 -----------------------------------------------
// Decoration/Engraving/Inscription = 効果あり; Crafting/Soulstone = 効果なし(正常)
const byCat: Record<string, { total: number; withEffect: number }> = {};
for (const d of Object.values(stats)) {
  const c = d.materialCategory;
  if (!c || c === "NONE") continue;
  byCat[c] ??= { total: 0, withEffect: 0 };
  byCat[c].total++;
  if ((d.materialEffects?.length || 0) > 0) byCat[c].withEffect++;
}
console.log("  material categories:", JSON.stringify(byCat));
for (const c of ["DECORATION", "ENGRAVING", "INSCRIPTION"]) {
  if (byCat[c]) check("E4", byCat[c].withEffect > 0, `${c} has at least one item with materialEffects`);
  else note("E4", `${c} not present in data`);
}
for (const c of ["CRAFTING", "SOULSTONE"]) {
  if (byCat[c]) check("E4", byCat[c].withEffect === 0, `${c} should have NO effects (got ${byCat[c].withEffect})`);
}

// ---- E5: data出現 stat-key ⊂ stat-i18n.stats ----------------------------
const i18nStatKeys = new Set(Object.keys(statI18n.stats));
const dataStatKeys = new Set<string>();
for (const d of Object.values(stats)) {
  for (const arr of [d.baseStats, d.inherentStats]) {
    for (const s of arr || []) dataStatKeys.add(s.key);
  }
  for (const e of d.materialEffects || []) dataStatKeys.add(e.key);
}
const untranslated = [...dataStatKeys].filter((k) => !i18nStatKeys.has(k));
console.log(`  distinct data stat-keys: ${dataStatKeys.size}, i18n stats keys: ${i18nStatKeys.size}`);
check("E5", untranslated.length === 0, `untranslated stat keys: ${untranslated.length}${untranslated.length ? " e.g. " + untranslated.slice(0, 15).join(", ") : ""}`);

// statKey 正規化が i18n キーと一致するか(label -> statKey が一致)
let keyMismatch = 0;
const mism: string[] = [];
for (const d of Object.values(stats)) {
  for (const arr of [d.baseStats, d.inherentStats]) {
    for (const s of arr || []) {
      if (statKey(s.label) !== s.key) {
        keyMismatch++;
        if (mism.length < 8) mism.push(`"${s.label}" -> ${statKey(s.label)} != ${s.key}`);
      }
    }
  }
}
if (keyMismatch) note("E5", `statKey(label) != stored key in ${keyMismatch} cases e.g. ${mism.join("; ")}`);

// ---- E6: 異常値 (valueMin 負 / 極端) ------------------------------------
let neg = 0,
  extreme = 0;
const negList: string[] = [];
for (const [h, d] of Object.entries(stats)) {
  for (const arr of [d.baseStats, d.inherentStats, d.materialEffects]) {
    for (const s of arr || []) {
      if (typeof s.valueMin === "number") {
        if (s.valueMin < 0) {
          neg++;
          if (negList.length < 10) negList.push(`${h}:${s.label}=${s.valueMin}`);
        }
        if (Math.abs(s.valueMin) > 100_000_00) extreme++; // > 100k (×100)
      }
      if (typeof s.valueMax === "number" && typeof s.valueMin === "number" && s.valueMax < s.valueMin) {
        note("E6", `${h}:${s.label} valueMax(${s.valueMax}) < valueMin(${s.valueMin})`);
      }
    }
  }
}
console.log(`  negative values: ${neg}, extreme values: ${extreme}`);
if (neg > 0) note("E6", `negative valueMin found (${neg}) — may be legit (e.g. cooldown reduction) e.g. ${negList.join(", ")}`);
check("E6", extreme === 0, `no absurd extreme values (got ${extreme})`);

// ---- 追加: stat-i18n.stats のうち data に出ないキー(未使用訳) ----------
const unusedI18n = [...i18nStatKeys].filter((k) => !dataStatKeys.has(k));
if (unusedI18n.length) note("E5", `stat-i18n has ${unusedI18n.length} keys not present in current data (superset, OK): ${unusedI18n.slice(0, 10).join(", ")}`);

console.log(`\nData (E): PASS ${pass} / FAIL ${fail} / WARN ${warn}`);
if (fail) {
  console.log("Failures:\n" + fails.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
