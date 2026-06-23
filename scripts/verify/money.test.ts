/**
 * C1-C9: money/index.ts pure-logic verification.
 * Run: npx tsx scripts/verify/money.test.ts
 */
import {
  formatMoney,
  currencyForLocale,
  isCurrency,
  STATIC_RATES,
  CURRENCIES,
  CURRENCY_BY_LOCALE,
} from "../../src/lib/money/index";

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

const R = STATIC_RATES;

// ---- C1: JPY 実値・≈なし ------------------------------------------------
{
  const s = formatMoney(8, "JPY", R);
  check("C1", !s.startsWith("≈"), `JPY no ≈ got "${s}"`);
  // ja-JP currency JPY -> "￥8"
  check("C1", /8/.test(s) && /[¥￥]/.test(s), `JPY shows ¥8 got "${s}"`);
}

// ---- C3 + C2: 換算式 yen × (rate[cur]/rate.JPY) -------------------------
function expected(yen: number, cur: keyof typeof R, dec: number, locale: string) {
  const v = yen * (R[cur] / R.JPY);
  return new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: dec }).format(v);
}
{
  const yen = 1500;
  // USD: 1500 * (1/150) = 10.00
  const usd = formatMoney(yen, "USD", R);
  check("C3", usd === "≈" + expected(yen, "USD", 2, "en-US"), `USD ${usd} vs ${"≈" + expected(yen, "USD", 2, "en-US")}`);
  check("C3", /10\.00/.test(usd), `1500yen -> $10.00 got "${usd}"`);
  // EUR: 1500 * (0.92/150) = 9.20
  const eur = formatMoney(yen, "EUR", R);
  check("C3", eur === "≈" + expected(yen, "EUR", 2, "de-DE"), `EUR ${eur}`);
  check("C3", /9,20/.test(eur), `1500yen -> 9,20€ (de-DE) got "${eur}"`);
  // KRW: 1500 * (1350/150) = 13500, 0 桁
  const krw = formatMoney(yen, "KRW", R);
  check("C3", krw === "≈" + expected(yen, "KRW", 0, "ko-KR"), `KRW ${krw}`);
  check("C6", !/[.,]\d{2}\b/.test(krw.replace(/[,\d]{4,}/g, "")), `KRW no decimals got "${krw}"`);
  // CNY: 1500 * (7.2/150) = 72.00
  const cny = formatMoney(yen, "CNY", R);
  check("C3", cny === "≈" + expected(yen, "CNY", 2, "zh-CN"), `CNY ${cny}`);
  // RUB: 1500 * (90/150) = 900, 0桁
  const rub = formatMoney(yen, "RUB", R);
  check("C3", rub === "≈" + expected(yen, "RUB", 0, "ru-RU"), `RUB ${rub}`);
  // BRL: 1500 * (5.4/150) = 54.00
  const brl = formatMoney(yen, "BRL", R);
  check("C3", brl === "≈" + expected(yen, "BRL", 2, "pt-BR"), `BRL ${brl}`);
}

// ---- C2: 全7通貨が ≈ を付ける(JPY以外) --------------------------------
for (const c of CURRENCIES) {
  const s = formatMoney(1000, c, R);
  if (c === "JPY") check("C2", !s.startsWith("≈"), `${c} no ≈`);
  else check("C2", s.startsWith("≈"), `${c} has ≈ got "${s}"`);
}

// ---- C6: 小数桁 ----------------------------------------------------------
{
  // 端数の出る金額で桁を検査
  const yen = 333;
  const dec0 = ["JPY", "KRW", "RUB"] as const;
  const dec2 = ["USD", "EUR", "CNY", "BRL"] as const;
  for (const c of dec0) {
    const v = yen * (R[c] / R.JPY);
    const ref = new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(v);
    const out = formatMoney(yen, c, R);
    // 桁0なら小数点が無い(数字部分に .NN が無い)
    check("C6", !/\d\.\d/.test(out) && !/\d,\d{2}(?!\d)/.test(out.replace(/\d{1,3}([.,]\d{3})+/g, "")), `${c} 0-dec got "${out}"`);
  }
  for (const c of dec2) {
    const out = formatMoney(1234, c, R);
    check("C6", /\d[.,]\d{2}(\D|$)/.test(out), `${c} 2-dec got "${out}"`);
  }
}

// ---- C4: currencyForLocale ----------------------------------------------
const localeExp: Record<string, string> = { en: "USD", ja: "JPY", ko: "KRW", zh: "CNY", ru: "RUB", pt: "BRL", es: "EUR", fr: "EUR", de: "EUR" };
for (const [loc, exp] of Object.entries(localeExp)) {
  check("C4", currencyForLocale(loc) === exp, `${loc} -> ${exp} got ${currencyForLocale(loc)}`);
}
check("C4", currencyForLocale("xx") === "USD", `unknown -> USD default`);
check("C4", Object.keys(CURRENCY_BY_LOCALE).length === 9, `CURRENCY_BY_LOCALE 9 entries got ${Object.keys(CURRENCY_BY_LOCALE).length}`);

// ---- C5: isCurrency ------------------------------------------------------
check("C5", isCurrency("USD") && isCurrency("JPY"), `valid true`);
check("C5", !isCurrency("usd") && !isCurrency("XXX") && !isCurrency("") && !isCurrency(null) && !isCurrency(undefined), `invalid false`);

// ---- C7: フォールバック (rates 引数欠落/部分欠落で STATIC へ) ------------
{
  // r が部分的(EUR欠落) -> STATIC_RATES.EUR を使う
  const partial = { USD: 1, JPY: 150 } as Record<string, number>;
  const out = formatMoney(1500, "EUR", partial);
  const want = "≈" + new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(1500 * (STATIC_RATES.EUR / 150));
  check("C7", out === want, `partial rates fall back to STATIC EUR got "${out}" want "${want}"`);
  // JPY 欠落時は STATIC_RATES.JPY=150 を分母に使う
  const noJpy = { USD: 1, EUR: 0.92 } as Record<string, number>;
  const out2 = formatMoney(1500, "USD", noJpy);
  check("C7", /10\.00/.test(out2), `JPY missing uses STATIC 150 denom got "${out2}"`);
}

console.log(`\nMoney (C): PASS ${pass} / FAIL ${fail}`);
if (fail) {
  console.log("Failures:\n" + fails.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
