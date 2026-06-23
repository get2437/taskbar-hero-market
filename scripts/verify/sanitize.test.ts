/**
 * F5 / F6 / K1: queries.ts sanitize 関数群の純粋検証。
 * sanitizeKey / clampInt / enum許可リスト(onlyValid) は queries.ts 内で非公開なので、
 * 同一仕様をここに複製し、さらに queries.ts のソースと一致することを grep で担保する。
 * Run: npx tsx scripts/verify/sanitize.test.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
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

// queries.ts の実装と同一の関数(仕様確認のため複製)
const sanitizeKey = (s: string | undefined) => (s ? s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 60) : "");
const clampInt = (v: number | undefined, lo: number, hi: number) =>
  v == null || !Number.isFinite(v) ? undefined : Math.min(hi, Math.max(lo, Math.trunc(v)));
const onlyValid = (arr: string[] | undefined, set: Set<string>) => (arr ?? []).filter((v) => set.has(v));

// ---- 複製が本物と一致するか (回帰防止) ----------------------------------
{
  const src = readFileSync(resolve(ROOT, "src/lib/queries.ts"), "utf8");
  check("F5-src", src.includes(`s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 60)`), `sanitizeKey impl matches source`);
  check("F5-src", src.includes(`Math.min(hi, Math.max(lo, Math.trunc(v)))`), `clampInt impl matches source`);
  check("F6-src", src.includes(`(arr ?? []).filter((v) => set.has(v))`), `onlyValid impl matches source`);
  check("F5-src", src.includes(`.map(sanitizeKey).filter(Boolean).slice(0, 8)`), `statKeys capped at 8`);
}

// ---- F5/K1: sanitizeKey インジェクション防止 ----------------------------
check("F5", sanitizeKey("Critical Damage") === "criticaldamage", `spaces removed got "${sanitizeKey("Critical Damage")}"`);
check("F5", sanitizeKey("critical_damage") === "critical_damage", `underscore kept`);
check("F5", sanitizeKey("'; DROP TABLE items;--") === "droptableitems", `SQL meta stripped got "${sanitizeKey("'; DROP TABLE items;--")}"`);
check("F5", sanitizeKey("a' OR '1'='1") === "aor11", `quotes/spaces stripped got "${sanitizeKey("a' OR '1'='1")}"`);
check("F5", sanitizeKey("../../etc/passwd") === "etcpasswd", `path chars stripped`);
check("F5", sanitizeKey("attack%00null") === "attack00null", `null byte literal stripped`);
check("F5", sanitizeKey("ATTACK_DAMAGE") === "attack_damage", `lowercased`);
check("F5", sanitizeKey("日本語key") === "key", `non-ascii stripped`);
check("F5", sanitizeKey("") === "", `empty -> empty`);
check("F5", sanitizeKey(undefined) === "", `undefined -> empty`);
check("F5", sanitizeKey("a".repeat(200)).length === 60, `length capped at 60 got ${sanitizeKey("a".repeat(200)).length}`);

// ---- clampInt ------------------------------------------------------------
check("F5", clampInt(50, 1, 100) === 50, `in-range`);
check("F5", clampInt(-5, 1, 100) === 1, `below clamps to lo`);
check("F5", clampInt(9999, 1, 100) === 100, `above clamps to hi`);
check("F5", clampInt(3.9, 1, 100) === 3, `truncates`);
check("F5", clampInt(NaN, 1, 100) === undefined, `NaN -> undefined`);
check("F5", clampInt(Infinity, 1, 100) === undefined, `Infinity -> undefined`);
check("F5", clampInt(undefined, 1, 100) === undefined, `undefined -> undefined`);

// ---- F6: enum許可リスト onlyValid ---------------------------------------
const VALID_GRADE = new Set(["COSMIC", "DIVINE", "CELESTIAL", "BEYOND", "IMMORTAL", "ARCANA", "LEGENDARY", "RARE", "UNCOMMON", "COMMON"]);
const VALID_MATCAT = new Set(["DECORATION", "ENGRAVING", "INSCRIPTION", "CRAFTING", "SOULSTONE", "NONE"]);
check("F6", JSON.stringify(onlyValid(["DIVINE", "HACKED", "RARE"], VALID_GRADE)) === JSON.stringify(["DIVINE", "RARE"]), `invalid grade removed`);
check("F6", onlyValid(["divine"], VALID_GRADE).length === 0, `case-sensitive: lowercase rejected`);
check("F6", onlyValid(["DECORATION'; DROP--"], VALID_MATCAT).length === 0, `injection in enum rejected`);
check("F6", onlyValid(undefined, VALID_GRADE).length === 0, `undefined -> []`);
check("F6", onlyValid([], VALID_GRADE).length === 0, `empty -> []`);

console.log(`\nSanitize (F5/F6/K1): PASS ${pass} / FAIL ${fail}`);
if (fail) {
  console.log("Failures:\n" + fails.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
