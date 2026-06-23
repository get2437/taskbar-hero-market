/**
 * B1-B11: descriptions.ts parser unit verification.
 * Run: npx tsx scripts/verify/parser.test.ts
 *
 * Steam のリスティングHTMLは descriptions[].value が多重JSONエスケープされた BBCode。
 * 実HTMLを模した多重エスケープ文字列を食わせ、期待構造を assert する。
 */
import {
  parseListingDescription,
  toStatLines,
  toItemDescriptionFields,
  statKey,
} from "../../src/lib/steam/descriptions";

let pass = 0;
let fail = 0;
const fails: string[] = [];
function check(id: string, cond: boolean, msg: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    fails.push(`[${id}] ${msg}`);
    console.error(`  FAIL [${id}] ${msg}`);
  }
}

/**
 * descriptions 配列を Steam SSR と同じ多重エスケープHTMLに包む。
 * 実ページは var g_rgAssets = {...} 内に \" でエスケープされた JSON が入る。
 */
function wrapHtml(lines: string[], type: string): string {
  const value = lines.join("\n");
  // descriptions[].value を JSON 化し、さらに HTML への二重エスケープ ( \\\" , \\n ) を模す
  const inner = JSON.stringify({
    descriptions: [{ type: "html", value }],
    type,
    market_hash_name: "X",
  });
  // JSON.stringify でできた \" を \\\" に, \n を \\n に (=二重エスケープ)
  const doubled = inner.replace(/\\/g, "\\\\");
  return `<script>var x = "${doubled}";</script>`;
}

// ---- B1: 装備パース ------------------------------------------------------
{
  const html = wrapHtml(
    [
      "[b]Divine Grade[/b]",
      "An ancient blade.", // section前の地の文 = flavor
      "Requires Lv. 65",
      "Decoration Slot x2",
      "Engraving Slot x1",
      "Base Stats",
      "+36.9 Attack Damage",
      "+423 Defense",
      "Inherent Stats",
      "38% Critical Damage",
      "Unique Stats",
      "Deals 200% extra damage to bosses below 30% HP.",
    ],
    "Tome - Lv. 65",
  );
  const d = parseListingDescription(html);
  check("B1", d.grade === "Divine", `grade expected Divine got ${d.grade}`);
  check("B1", d.requiredLevel === 65, `reqLevel expected 65 got ${d.requiredLevel}`);
  check("B1", d.slots.decoration === 2, `deco expected 2 got ${d.slots.decoration}`);
  check("B1", d.slots.engraving === 1, `engrave expected 1 got ${d.slots.engraving}`);
  check("B1", d.itemType === "Tome - Lv. 65", `itemType got ${d.itemType}`);
  check("B1", d.baseStats.length === 2, `baseStats len got ${d.baseStats.length}`);
  check("B1", d.inherentStats.length === 1, `inherent len got ${d.inherentStats.length}`);
  check("B1", d.uniqueStats.length === 1, `unique len got ${d.uniqueStats.length}`);

  // B6: 値スケール
  const ad = d.baseStats.find((s) => s.key === "attack_damage");
  check("B6", !!ad && ad.valueMin === 3690, `+36.9 -> 3690 got ${ad?.valueMin}`);
  check("B6", !!ad && ad.unit === "FLAT", `attack unit FLAT got ${ad?.unit}`);
  const def = d.baseStats.find((s) => s.key === "defense");
  check("B6", !!def && def.valueMin === 42300, `423 -> 42300 got ${def?.valueMin}`);
  const cd = d.inherentStats.find((s) => s.key === "critical_damage");
  check("B6", !!cd && cd.valueMin === 3800, `38% -> 3800 got ${cd?.valueMin}`);
  check("B6", !!cd && cd.unit === "PCT", `38% unit PCT got ${cd?.unit}`);

  // B5: Unique は TEXT 全文保持(数値を剥がさない)
  const u = d.uniqueStats[0];
  check("B5", !!u && u.unit === "TEXT", `unique unit TEXT got ${u?.unit}`);
  check("B5", !!u && u.valueMin === null, `unique valueMin null got ${u?.valueMin}`);
  check("B5", !!u && /200%/.test(u.label), `unique keeps 200% in label got "${u?.label}"`);

  // flavor
  check("B1", d.flavor === "An ancient blade.", `flavor got "${d.flavor}"`);

  // B10: toStatLines / toItemDescriptionFields
  const lines = toStatLines(d);
  const baseLine = lines.find((l) => l.statKey === "attack_damage");
  check("B10", baseLine?.kind === "BASE", `attack kind BASE got ${baseLine?.kind}`);
  check("B10", baseLine?.appliesTo === "NONE", `base appliesTo NONE got ${baseLine?.appliesTo}`);
  const specialLine = lines.find((l) => l.kind === "SPECIAL");
  check("B10", !!specialLine && specialLine.valueMin === null, `special line valueMin null`);
  const f = toItemDescriptionFields(d);
  check("B10", f.requiredLevel === 65 && f.decoSlots === 2 && f.engraveSlots === 1, `fields got ${JSON.stringify(f)}`);
}

// ---- B2: 装飾素材 (Weapon Decoration Effect, tier, range) ----------------
{
  const html = wrapHtml(
    [
      "Common Grade",
      "Weapon Decoration Effect",
      "[T2] +5 ~ 10 Attack Damage",
      "Armor Decoration Effect",
      "[T3] 2~4% Defense", // 実データ準拠: % は上限/トークン末尾にのみ付く
    ],
    "Decoration Material",
  );
  const d = parseListingDescription(html);
  check("B8", d.materialCategory === "DECORATION", `matCat DECORATION got ${d.materialCategory}`);
  check("B2", d.materialEffects.length === 2, `matEffects len 2 got ${d.materialEffects.length}`);
  const wpn = d.materialEffects.find((e) => e.target === "WEAPON");
  check("B2", !!wpn && wpn.tier === 2, `weapon tier 2 got ${wpn?.tier}`);
  check("B2", !!wpn && wpn.valueMin === 500 && wpn.valueMax === 1000, `5~10 -> 500/1000 got ${wpn?.valueMin}/${wpn?.valueMax}`);
  const arm = d.materialEffects.find((e) => e.target === "ARMOR");
  check("B2", !!arm && arm.tier === 3, `armor tier 3 got ${arm?.tier}`);
  check("B2", !!arm && arm.valueMin === 200 && arm.valueMax === 400 && arm.unit === "PCT", `2~4% -> 200/400 PCT got ${arm?.valueMin}/${arm?.valueMax}/${arm?.unit}`);
}

// ---- B6b: 範囲の下限に % が付く表記 "2% ~ 4%" も範囲として認識する (WARN-1 修正後) --
// VALUE_RE が下限/上限どちらの % でも PCT 判定し、max を取りこぼさないこと。
{
  const html = wrapHtml(["Base Stats", "2% ~ 4% Defense"], "Tome");
  const d = parseListingDescription(html);
  const s = d.baseStats[0];
  check("B6b", !!s && s.valueMin === 200 && s.valueMax === 400 && s.unit === "PCT",
    `"2% ~ 4%" → min=200 max=400 PCT (got min=${s?.valueMin} max=${s?.valueMax} ${s?.unit})`);
}

// ---- B12: 改行なし1行の説明文 (Bat Wing Membrane形式) を正しくパース (FAIL-1 修正) ----
// 一部アイテムは説明文が改行なし1行で返る。ensureLineBreaks が見出し/オプションを行へ補い、
// 対象(Weapon/Armor/Accessory)も正しく割り当てられること。見出し語が誤って項目化されないこと。
{
  const oneLine =
    "Basic engraving material. Weapon Engraving Effect List - [T4] Lightning Damage +40~50% - [T4] Fire Damage +40~50% Armor Engraving Effect List - [T3] Damage Reduction +3.0~4.0% - [T3] Max HP +60~90 Accessory Engraving Effect List - [T3] Critical Damage +20~25% - [T3] HP Per Hit +1~2";
  const d = parseListingDescription(wrapHtml([oneLine], "Engraving Material"));
  const eff = d.materialEffects;
  const byT = (t: string) => eff.filter((e) => e.target === t).map((e) => e.key).join(",");
  check("B12-count", eff.length === 6, `single-line engraving → 6 effects (got ${eff.length})`);
  check("B12-weapon", byT("WEAPON") === "lightning_damage,fire_damage", `WEAPON (got ${byT("WEAPON")})`);
  check("B12-armor", byT("ARMOR") === "damage_reduction,max_hp", `ARMOR (got ${byT("ARMOR")})`);
  check("B12-accessory", byT("ACCESSORY") === "critical_damage,hp_per_hit", `ACCESSORY (got ${byT("ACCESSORY")})`);
  check("B12-nospurious", !eff.some((e) => e.unit === "TEXT"), `no header parsed as stat (got ${eff.filter((e) => e.unit === "TEXT").map((e) => e.label)})`);
}

// ---- B3: 彫刻素材 "Effect List" 形式 -------------------------------------
{
  const html = wrapHtml(
    [
      "Weapon Engraving Effect List",
      "[T1] +3 Critical Rate",
      "[T2] +6 Critical Rate",
    ],
    "Engraving Material",
  );
  const d = parseListingDescription(html);
  check("B8", d.materialCategory === "ENGRAVING", `matCat ENGRAVING got ${d.materialCategory}`);
  check("B3", d.materialEffects.length === 2, `engraving effects len 2 got ${d.materialEffects.length}`);
  check("B3", d.materialEffects.every((e) => e.target === "WEAPON"), `all WEAPON target`);
  check("B3", d.flavor === null, `engraving flavor should be null (not leaked) got "${d.flavor}"`);
}

// ---- B4: 碑文素材 target無し + [T6-T8] -----------------------------------
{
  const html = wrapHtml(
    [
      "Inscription Effect List",
      "[T6-T8] +12 ~ 20 All Stats",
    ],
    "Inscription Material",
  );
  const d = parseListingDescription(html);
  check("B8", d.materialCategory === "INSCRIPTION", `matCat INSCRIPTION got ${d.materialCategory}`);
  check("B4", d.materialEffects.length === 1, `inscription effects len 1 got ${d.materialEffects.length}`);
  const e = d.materialEffects[0];
  check("B4", !!e && e.target === "NONE", `inscription target NONE got ${e?.target}`);
  check("B4", !!e && e.tier === 6, `[T6-T8] -> tier 6 (lower bound) got ${e?.tier}`);
  check("B4", !!e && e.valueMin === 1200 && e.valueMax === 2000, `12~20 -> 1200/2000 got ${e?.valueMin}/${e?.valueMax}`);
  // toStatLines appliesTo
  const sl = toStatLines(d).find((l) => l.kind === "MATERIAL_EFFECT");
  check("B4", sl?.appliesTo === "NONE", `statline appliesTo NONE got ${sl?.appliesTo}`);
  check("B4", sl?.tier === 6, `statline tier 6 got ${sl?.tier}`);
}

// ---- B7: 値先頭表記 "39% Increased Area of Effect" -----------------------
{
  const html = wrapHtml(["Base Stats", "39% Increased Area of Effect"], "Tome");
  const d = parseListingDescription(html);
  const s = d.baseStats[0];
  check("B7", !!s && s.valueMin === 3900 && s.unit === "PCT", `39% -> 3900 PCT got ${s?.valueMin}/${s?.unit}`);
  check("B7", !!s && /Increased Area of Effect/i.test(s.label) && !/39/.test(s.label), `label sans number got "${s?.label}"`);
}

// ---- B8: materialCategory 全種 -------------------------------------------
{
  for (const [type, exp] of [
    ["Crafting Material", "CRAFTING"],
    ["Soulstone", "SOULSTONE"],
  ] as const) {
    const d = parseListingDescription(wrapHtml(["Common Grade"], type));
    check("B8", d.materialCategory === exp, `${type} -> ${exp} got ${d.materialCategory}`);
  }
}

// ---- B9: 多重エスケープ解除 ----------------------------------------------
{
  // value 内に \\\"quoted\\\" と \\\\n を含む(さらに wrapHtml が二重化)
  const html = wrapHtml(['Base Stats', '+10 "Special" Power'], "Tome");
  const d = parseListingDescription(html);
  const s = d.baseStats[0];
  check("B9", !!s, `unescape produced a stat`);
  check("B9", !!s && s.valueMin === 1000, `value 10 -> 1000 got ${s?.valueMin}`);
}

// ---- B11: 空 / 壊れたHTML ------------------------------------------------
{
  const empty = parseListingDescription("");
  check("B11", empty.baseStats.length === 0 && empty.grade === null, `empty -> EMPTY`);
  const nodesc = parseListingDescription("<html><body>no descriptions here</body></html>");
  check("B11", nodesc.baseStats.length === 0, `no descriptions -> empty stats`);
  const broken = parseListingDescription('<script>var x="descriptions\\":[{\\"value\\":\\"');
  check("B11", Array.isArray(broken.baseStats), `broken HTML returns object without throwing`);
}

// ---- statKey 正規化 -------------------------------------------------------
check("statKey", statKey("Critical Damage") === "critical_damage", `statKey`);
check("statKey", statKey("All Stats!!!") === "all_stats", `statKey trims`);

console.log(`\nParser (B): PASS ${pass} / FAIL ${fail}`);
if (fail) {
  console.log("Failures:\n" + fails.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
