import fs from "node:fs";
const html = fs.readFileSync("demo.html", "utf8");
const script = html.split("<script>")[1].split("</scr" + "ipt>")[0];
const mk = () => ({ innerHTML: "", style: {}, classList: { toggle() {}, add() {}, remove() {} }, querySelectorAll() { return []; }, querySelector() { return mk(); }, dataset: {}, addEventListener() {}, set onclick(v) {}, set onchange(v) {}, set oninput(v) {} });
globalThis.document = { getElementById() { return mk(); }, querySelectorAll() { return []; }, querySelector() { return mk(); }, addEventListener() {}, createElement() { return mk(); }, get documentElement() { return { lang: "" }; } };
globalThis.window = { addEventListener() {}, scrollTo() {} };
globalThis.location = { get hash() { return "#items"; }, set hash(v) {}, replace() { return ""; } };
globalThis.scrollTo = () => {};
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

const ctx = {};
const run = new Function("with(this){" + script + "\nreturn {setLang:(l)=>{LANG=l},NAV,t,localize,vDashboard,vItems,vItem,vNews,buildComment,ITEMS};}").call(ctx);

const h1 = (s) => (s.match(/<h1>([^<]+)<\/h1>/) || [])[1];
const h3 = (s) => (s.match(/<h3>([^<]+)<\/h3>/) || [])[1];
const undervalued = run.ITEMS.find((i) => i.a.under >= 1000) || run.ITEMS[0];

for (const lang of ["en", "ja", "ko", "zh", "ru"]) {
  run.setLang(lang);
  const nav = run.NAV.map((n) => run.t(n[1])).join(" | ");
  const items = h1(run.localize(run.vItems()));
  const analysis = (run.localize(run.vItem(run.ITEMS[0].id)).match(/Investment Analysis|投資分析|투자 분석|投资分析|Инвест-анализ/) || [])[0];
  const news = h1(run.vNews());
  const news1 = h3(run.vNews());
  const comment = run.buildComment(undervalued).slice(0, 64);
  console.log(`[${lang}] nav: ${nav}`);
  console.log(`     items=${items} | analysis=${analysis} | news=${news} -> ${news1}`);
  console.log(`     comment: ${comment}`);
}
