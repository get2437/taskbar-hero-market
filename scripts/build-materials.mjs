// 素材まとめ表のデータを生成する。
//  入力:
//   assets/_materials-wiki-raw.txt   … 全125→実115件の骨格 (name|wikiCat|rarity|path|img)
//   assets/stats.json                … 既存44件の正確な materialEffects (Steam出品ページ由来)
//   assets/_materials-effects.txt     … wiki(tbhwiki.org)由来の35件の効果 (Wolf Fangで精度検証済)
//   assets/market.json               … Steamアイコン/参考価格 (出品中のみ)
//   assets/stat-i18n.json            … statKey ↔ 英語名 (逆引きに使用)
//  出力:
//   assets/materials.json
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const j = (p) => JSON.parse(read(p));

const CATMAP = { Gems: "DECORATION", Creature: "ENGRAVING", Inscription: "INSCRIPTION", Crafting: "CRAFTING", Soulstone: "SOULSTONE", Anniversary: "ANNIVERSARY" };

// --- statKey 逆引きマップ (英語名 -> key) ---
const si = j("assets/stat-i18n.json");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const nameToKey = new Map();
for (const [k, v] of Object.entries(si.stats)) if (v.en) nameToKey.set(norm(v.en), k);
// wiki由来で別表記のものを補正
const ALIAS = {
  "increase area of effect damage": "increased_area_of_effect_damage",
  "increase melee damage": "increased_melee_damage",
  "increase projectile damage": "increased_projectile_damage",
  "increase summon damage": "increased_summon_damage",
  "area of effect": "increased_area_of_effect",
  "critical chance": "increased_critical_chance",
  "cast speed": "increased_cast_speed",
  "skill duration increase": "skill_duration_increase",
  "skill heal increase": "skill_heal_increase",
  "damage absorption": "damage_absorption",
  "multistrike": "multistrike",
  "projectile count": "projectile_count",
};
const unmapped = new Set();
function toKey(name) {
  const n = norm(name);
  if (nameToKey.has(n)) return nameToKey.get(n);
  if (ALIAS[n]) return ALIAS[n];
  unmapped.add(name);
  return n.replace(/ /g, "_"); // フォールバック (snake_case)
}

// 値表記をパース: "+9~10%" -> {min,max,unit,display}
function parseValue(raw) {
  const pct = /%/.test(raw);
  const cleaned = raw.replace(/[+,%\s]/g, "");
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)(?:~(-?\d+(?:\.\d+)?))?$/);
  let min = null, max = null;
  if (m) { min = parseFloat(m[1]); max = m[2] != null ? parseFloat(m[2]) : min; }
  return { min, max, unit: pct ? "PCT" : "FLAT", display: raw.trim() };
}

// 既存44件 (×100整数 -> 表示文字列に戻す)
function dispFromOur(e) {
  const f = (x) => { const n = x / 100; return Number.isInteger(n) ? String(n) : String(n); };
  const u = e.unit === "PCT" ? "%" : "";
  const v = e.valueMax != null && e.valueMax !== e.valueMin ? `${f(e.valueMin)}~${f(e.valueMax)}${u}` : `${f(e.valueMin)}${u}`;
  return `+${v}`;
}

// --- 1. 骨格 ---
const rows = read("assets/_materials-wiki-raw.txt").split("\n").filter((l) => l.trim());
const mats = new Map(); // name -> material
for (const l of rows) {
  const [name, wcat, rarity, path, img] = l.split("|").map((s) => s.trim());
  mats.set(name, {
    name,
    category: CATMAP[wcat] || wcat.toUpperCase(),
    rarity: rarity.toUpperCase(),
    slug: path.split("/").pop(),
    wikiImage: img, // probonk: /game/items/materials/Item_NNNNNN.png
    steamIcon: null,
    refPriceYen: null,
    onMarket: false,
    effects: [],
  });
}

// --- 2. 既存44件の効果 (正確) ---
const stats = j("assets/stats.json");
for (const [name, s] of mats) {
  const st = stats[name];
  if (st?.materialEffects?.length) {
    for (const e of st.materialEffects) {
      s.effects.push({ target: e.target ?? "ANY", tier: e.tier ?? null, statKey: e.key, label: e.label, value: dispFromOur(e), source: "steam" });
    }
  }
}

// --- 3. wiki由来35件の効果 ---
for (const l of read("assets/_materials-effects.txt").split("\n").filter((x) => x.trim())) {
  const [name, rest] = l.split("::").map((s) => s.trim());
  const [target, tier, label, value] = rest.split("|").map((s) => s.trim());
  const m = mats.get(name);
  if (!m) { console.warn("[warn] effect for unknown material:", name); continue; }
  if (m.effects.length && m.effects[0].source === "steam") continue; // 既存正確データ優先
  const pv = parseValue(value);
  m.effects.push({ target: target.toUpperCase(), tier: tier ? Number(tier.replace(/\D/g, "")) : null, statKey: toKey(label), label, value: pv.display, source: "wiki" });
}

// --- 4. 市場情報 (Steamアイコン / 参考価格) ---
const market = j("assets/market.json");
const arr = Array.isArray(market) ? market : market.items || [];
const mkt = new Map(arr.map((r) => [r.hash, r]));
// 価格は JPY 整数 (DBの lowestPrice と同じ単位。formatMoney/money は JPY整数を期待)。
const yen = (s) => { if (s == null) return null; const n = String(s).replace(/[^\d.]/g, ""); return n ? Math.round(parseFloat(n)) : null; };
for (const [name, m] of mats) {
  const r = mkt.get(name);
  if (r) {
    m.onMarket = true;
    m.steamIcon = r.icon ? `https://community.steamstatic.com/economy/image/${r.icon}` : null;
    m.refPriceYen = yen(r.lowest);
  }
}

// --- 5. 手動上書き (wiki/手元に無いデータ: 製作レベル, 記念コイン出力) ---
let extraN = 0;
if (fs.existsSync("assets/materials-extra.json")) {
  const extra = j("assets/materials-extra.json");
  for (const [name, ov] of Object.entries(extra)) {
    if (name.startsWith("_")) continue;
    const m = mats.get(name);
    if (!m) { console.warn("[warn] extra for unknown material:", name); continue; }
    if (ov.craftLevel != null) { m.craftLevel = String(ov.craftLevel); extraN++; }
    if (Array.isArray(ov.coinOutput) && ov.coinOutput.length) { m.coinOutput = ov.coinOutput; extraN++; }
    if (ov.coinNote) m.coinNote = String(ov.coinNote);
    if (ov.unreleased) { m.unreleased = true; extraN++; }
  }
}

const out = [...mats.values()];
fs.writeFileSync("assets/materials.json", JSON.stringify(out, null, 1));
if (extraN) console.log(`manual overrides applied: ${extraN}`);
const withEff = out.filter((m) => m.effects.length).length;
console.log(`materials.json: ${out.length} materials, ${withEff} with effects, onMarket=${out.filter((m) => m.onMarket).length}`);
const byCat = {};
for (const m of out) byCat[m.category] = (byCat[m.category] || 0) + 1;
console.log("by category:", JSON.stringify(byCat));
if (unmapped.size) console.log("UNMAPPED stat names (need stat-i18n keys):", [...unmapped].join(", "));
