/**
 * D1-D8: i18n coverage verification.
 * Run: npx tsx scripts/verify/i18n.test.ts
 *
 * messages.ts / facetMessages / stat-i18n.json / demo.html DICT/FT を機械検査し、
 * 全エントリに 9 locale が揃っているか、グループ分類網羅、CRLF混入、記号保持を確認。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { messages, facetMessages, LOCALES, LOCALE_LABEL } from "../../src/lib/i18n/messages";
import { STAT_KEYS, STAT_GROUP_OF, STAT_GROUP_ORDER } from "../../src/lib/i18n/index";
import statI18n from "../../assets/stat-i18n.json";

const ROOT = resolve(__dirname, "../..");
const LOCS = LOCALES as readonly string[];

let pass = 0,
  fail = 0;
const fails: string[] = [];
function check(id: string, cond: boolean, msg: string) {
  if (cond) pass++;
  else {
    fail++;
    fails.push(`[${id}] ${msg}`);
    console.error(`  FAIL [${id}] ${msg}`);
  }
}

// ---- D5: LOCALES / LABEL = 9 --------------------------------------------
check("D5", LOCS.length === 9, `LOCALES = 9 got ${LOCS.length}`);
check("D5", Object.keys(LOCALE_LABEL).length === 9, `LOCALE_LABEL = 9 got ${Object.keys(LOCALE_LABEL).length}`);
check("D5", LOCS.every((l) => l in LOCALE_LABEL), `every locale has label`);
check("D5", JSON.stringify([...LOCS].sort()) === JSON.stringify(["de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh"]), `exact 9 set`);

// helper: all 9 locales present & non-empty
function coverObj(name: string, id: string, table: Record<string, Record<string, string>>, expectCount?: number) {
  const keys = Object.keys(table);
  if (expectCount != null) check(id, keys.length === expectCount, `${name} count ${expectCount} got ${keys.length}`);
  let missing = 0;
  const sampleMiss: string[] = [];
  for (const [k, v] of Object.entries(table)) {
    for (const loc of LOCS) {
      if (typeof v[loc] !== "string" || v[loc].length === 0) {
        missing++;
        if (sampleMiss.length < 8) sampleMiss.push(`${k}.${loc}`);
      }
    }
  }
  check(id, missing === 0, `${name} missing ${missing} locale entries${sampleMiss.length ? " e.g. " + sampleMiss.join(", ") : ""}`);
}

// ---- D1: messages 全エントリ9言語 ---------------------------------------
coverObj("messages", "D1", messages as any);
console.log(`  messages entries: ${Object.keys(messages).length}`);

// ---- D2: facetMessages 9言語 --------------------------------------------
coverObj("facetMessages", "D2", facetMessages as any);
console.log(`  facetMessages entries: ${Object.keys(facetMessages).length}`);

// ---- D3: stat-i18n.json ui/stats/unique 9言語 ----------------------------
const SI = statI18n as any;
coverObj("stat-i18n.ui", "D3", SI.ui, 31);
coverObj("stat-i18n.stats", "D3", SI.stats, 44);
coverObj("stat-i18n.unique", "D3", SI.unique, 6);

// ---- D4: STAT_KEYS=44 / グループ網羅 -------------------------------------
check("D4", STAT_KEYS.length === 44, `STAT_KEYS 44 got ${STAT_KEYS.length}`);
const groups = new Set(STAT_GROUP_ORDER);
check("D4", JSON.stringify(STAT_GROUP_ORDER) === JSON.stringify(["offense", "defense", "resist", "sustain"]), `groupOrder got ${JSON.stringify(STAT_GROUP_ORDER)}`);
let ungrouped = 0;
const badGroup: string[] = [];
for (const k of STAT_KEYS) {
  const g = STAT_GROUP_OF[k];
  if (!g || g === "other" || !groups.has(g)) {
    ungrouped++;
    if (badGroup.length < 10) badGroup.push(`${k}=${g}`);
  }
}
check("D4", ungrouped === 0, `all 44 stats grouped into known groups; ${ungrouped} bad${badGroup.length ? " e.g. " + badGroup.join(", ") : ""}`);
// every group actually used
for (const g of STAT_GROUP_ORDER) {
  check("D4", Object.values(STAT_GROUP_OF).includes(g), `group "${g}" has at least one stat`);
}

// ---- D7: CRLF混入なし (バイト検査) --------------------------------------
for (const rel of ["src/lib/i18n/messages.ts", "assets/stat-i18n.json", "demo.html"]) {
  const buf = readFileSync(resolve(ROOT, rel));
  const cr = buf.indexOf(0x0d);
  check("D7", cr === -1, `${rel} has CR byte at offset ${cr} (CRLF)`);
}

// ---- D8: 記号保持 (◯ / % / ☆ / ¥ 等) ------------------------------------
// EN に特定記号を含むキーは全 locale で同記号を保持しているか
const SYMS = ["%", "☆", "·", "¥", "≈"];
let symLost = 0;
const symMiss: string[] = [];
for (const [k, v] of Object.entries(messages as Record<string, Record<string, string>>)) {
  for (const sym of SYMS) {
    if (v.en.includes(sym)) {
      for (const loc of LOCS) {
        if (loc === "en") continue;
        // 一部記号は意訳で消えることもあるが % と ☆ は通常保持される。% と ☆ のみ厳格検査。
        if ((sym === "%" || sym === "☆") && !v[loc].includes(sym)) {
          symLost++;
          if (symMiss.length < 12) symMiss.push(`${k}.${loc} lost "${sym}"`);
        }
      }
    }
  }
}
check("D8", symLost === 0, `symbols (% ☆) preserved across locales; ${symLost} lost${symMiss.length ? " e.g. " + symMiss.join("; ") : ""}`);

// ---- D6: demo.html DICT(139)/FT(33) 9言語 -------------------------------
// demo.html から DICT={...} と FT={...} のJSリテラルを抽出して検査。
{
  const demo = readFileSync(resolve(ROOT, "demo.html"), "utf8");
  function extractObj(varName: string): Record<string, any> | null {
    const m = demo.match(new RegExp("(?:const|var|let)\\s+" + varName + "\\s*=\\s*"));
    if (!m) return null;
    const start = demo.indexOf("{", m.index! + m[0].length);
    if (start < 0) return null;
    // ブレース対応で終端を探す(文字列内の波括弧も雑にケア)
    let depth = 0, inStr: string | null = null, esc = false;
    for (let i = start; i < demo.length; i++) {
      const ch = demo[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const lit = demo.slice(start, i + 1);
          try {
            // JS オブジェクトリテラル -> JSON 化は危険なので Function で評価
            // eslint-disable-next-line no-new-func
            return Function('"use strict";return (' + lit + ")")();
          } catch (e) {
            return null;
          }
        }
      }
    }
    return null;
  }
  const DICT = extractObj("DICT");
  const FT = extractObj("FT");
  check("D6", !!DICT, `demo DICT extracted`);
  check("D6", !!FT, `demo FT extracted`);
  // demo の設計: キー自体がソース言語の文字列で、値は「他8 locale」のマップ。
  //   DICT: キー=日本語(ja暗黙) → 値に en/ko/zh/ru/pt/es/fr/de が必要
  //   FT:   キー=英語(en暗黙)   → 値に ja/ko/zh/ru/pt/es/fr/de が必要
  function coverImplicit(name: string, id: string, table: Record<string, any>, implicit: string) {
    const need = LOCS.filter((l) => l !== implicit);
    let missing = 0;
    const sample: string[] = [];
    for (const [k, v] of Object.entries(table)) {
      for (const loc of need) {
        if (typeof v[loc] !== "string" || v[loc].length === 0) {
          missing++;
          if (sample.length < 8) sample.push(`${k}.${loc}`);
        }
      }
    }
    check(id, missing === 0, `${name} (implicit ${implicit}) missing ${missing}${sample.length ? " e.g. " + sample.join(", ") : ""}`);
  }
  if (DICT) {
    console.log(`  demo DICT entries: ${Object.keys(DICT).length}`);
    coverImplicit("demo.DICT", "D6", DICT, "ja");
  }
  if (FT) {
    console.log(`  demo FT entries: ${Object.keys(FT).length}`);
    coverImplicit("demo.FT", "D6", FT, "en");
  }
}

console.log(`\ni18n (D): PASS ${pass} / FAIL ${fail}`);
if (fail) {
  console.log("Failures:\n" + fails.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
