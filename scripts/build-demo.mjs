// assets/market.json の実データを demo.html の MARKET placeholder に注入する。
import fs from "node:fs";

const market = JSON.parse(fs.readFileSync("assets/market.json", "utf8"));
const compact = market.map((m) => ({
  name: m.name,
  hash: m.hash,
  icon: m.icon || "",
  lowest: m.lowest || null,
  median: m.median || null,
  volume: m.volume || 0,
  listings: m.listings || 0,
}));

const json = JSON.stringify(compact);
let html = fs.readFileSync("demo.html", "utf8");

// MARKET 注入
const re = /const MARKET=\/\*__MARKET__\*\/.*?;\n/s;
if (!re.test(html)) { console.error("MARKET placeholder not found"); process.exit(1); }
html = html.replace(re, `const MARKET=/*__MARKET__*/${json};\n`);

// TAGS 注入 (あれば)
let tagCount = 0;
if (fs.existsSync("assets/tags.json")) {
  const tags = JSON.parse(fs.readFileSync("assets/tags.json", "utf8"));
  tagCount = Object.keys(tags).length;
  const tre = /const TAGS=\/\*__TAGS__\*\/.*?;\n/s;
  if (tre.test(html)) html = html.replace(tre, `const TAGS=/*__TAGS__*/${JSON.stringify(tags)};\n`);
}

// STATS 注入 (あれば) — 説明文由来のステータス
let statCount = 0;
if (fs.existsSync("assets/stats.json")) {
  const stats = JSON.parse(fs.readFileSync("assets/stats.json", "utf8"));
  statCount = Object.keys(stats).length;
  const sre = /const STATS=\/\*__STATS__\*\/.*?;\n/s;
  if (sre.test(html)) html = html.replace(sre, `const STATS=/*__STATS__*/${JSON.stringify(stats)};\n`);
}

// STAT_I18N 注入 (あれば) — ステータス名・見出しの多言語辞書
if (fs.existsSync("assets/stat-i18n.json")) {
  const si = JSON.parse(fs.readFileSync("assets/stat-i18n.json", "utf8"));
  const sire = /const STAT_I18N=\/\*__STATI18N__\*\/.*?;\n/s;
  if (sire.test(html)) html = html.replace(sire, `const STAT_I18N=/*__STATI18N__*/${JSON.stringify(si)};\n`);
}

// NEWS 注入 (あれば)
let newsCount = 0;
if (fs.existsSync("assets/news-i18n.json")) {
  const news = JSON.parse(fs.readFileSync("assets/news-i18n.json", "utf8"));
  newsCount = news.length;
  const nre = /const NEWS=\/\*__NEWS__\*\/.*?;\n/s;
  if (nre.test(html)) html = html.replace(nre, `const NEWS=/*__NEWS__*/${JSON.stringify(news)};\n`);
}

// ORDERS 注入 (あれば)
let orderCount = 0;
if (fs.existsSync("assets/orders.json")) {
  const orders = JSON.parse(fs.readFileSync("assets/orders.json", "utf8"));
  orderCount = Object.values(orders).filter((o) => (o.sell && o.sell.length) || (o.buy && o.buy.length)).length;
  const ore = /const ORDERS=\/\*__ORDERS__\*\/.*?;\n/s;
  if (ore.test(html)) html = html.replace(ore, `const ORDERS=/*__ORDERS__*/${JSON.stringify(orders)};\n`);
}

// クラスアイコンを base64 で注入 (public/classes/*.png)。demo は単一ファイルのため埋め込む。
const CLASS_FILES = { knight: "knight.png", slayer: "slayer.png", hunter: "hunter.png", ranger: "ranger.png", sorcerer: "sorcerer.png", priest: "priest.png" };
const classIcons = {};
for (const [cls, file] of Object.entries(CLASS_FILES)) {
  const p = `public/classes/${file}`;
  if (fs.existsSync(p)) classIcons[cls] = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
}
const cire = /const CLASS_ICONS=\/\*__CLASS_ICONS__\*\/.*?;\n/s;
if (cire.test(html)) html = html.replace(cire, `const CLASS_ICONS=/*__CLASS_ICONS__*/${JSON.stringify(classIcons)};\n`);
const classIconCount = Object.keys(classIcons).length;

// クラス背景アート (一覧背景用・最適化JPEGを base64 で埋め込む)
// 単一クラス + 特定コンボ(クラス名ソート連結キー)。
const classBg = {};
for (const cls of Object.keys(CLASS_FILES)) {
  const p = `assets/${cls}-bg-demo.jpg`;
  if (fs.existsSync(p)) classBg[cls] = `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`;
}
const COMBO_FILES = {
  "ranger+sorcerer": "combo-ranger-sorcerer-bg-demo.jpg",
  "priest+ranger": "combo-priest-ranger-bg-demo.jpg",
  "hunter+priest+ranger": "combo-hunter-priest-ranger-bg-demo.jpg",
};
for (const [key, file] of Object.entries(COMBO_FILES)) {
  const p = `assets/${file}`;
  if (fs.existsSync(p)) classBg[key] = `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`;
}
const cbre = /const CLASS_BG=\/\*__CLASS_BG__\*\/.*?;\n/s;
if (cbre.test(html)) html = html.replace(cbre, `const CLASS_BG=/*__CLASS_BG__*/${JSON.stringify(classBg)};\n`);
const classBgCount = Object.keys(classBg).length;

// MATERIALS 注入 (素材まとめ表) + 素材アイコンを base64 で埋め込む
let matCount = 0;
if (fs.existsSync("assets/materials.json")) {
  const mats = JSON.parse(fs.readFileSync("assets/materials.json", "utf8"));
  matCount = mats.length;
  // demo用に軽量化 (wikiImage/steamIcon は不要・ローカルbase64を使う)
  const compactMats = mats.map((m) => ({
    name: m.name, category: m.category, rarity: m.rarity, slug: m.slug,
    onMarket: m.onMarket, refPriceYen: m.refPriceYen, effects: m.effects,
    ...(m.craftLevel ? { craftLevel: m.craftLevel } : {}),
    ...(m.coinOutput ? { coinOutput: m.coinOutput } : {}),
    ...(m.coinNote ? { coinNote: m.coinNote } : {}),
    ...(m.unreleased ? { unreleased: true } : {}),
  }));
  const mre = /const MATERIALS=\/\*__MATERIALS__\*\/.*?;\n/s;
  if (mre.test(html)) html = html.replace(mre, `const MATERIALS=/*__MATERIALS__*/${JSON.stringify(compactMats)};\n`);
  const matIcons = {};
  for (const m of mats) {
    const p = `public/materials/${m.slug}.png`;
    if (fs.existsSync(p)) matIcons[m.slug] = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  }
  const mire = /const MAT_ICONS=\/\*__MAT_ICONS__\*\/.*?;\n/s;
  if (mire.test(html)) html = html.replace(mire, `const MAT_ICONS=/*__MAT_ICONS__*/${JSON.stringify(matIcons)};\n`);
}

// データ取得日時を注入
const snapshot = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
html = html.replace(/const SNAPSHOT=\/\*__SNAPSHOT__\*\/"[^"]*";/, `const SNAPSHOT=/*__SNAPSHOT__*/"${snapshot}";`);

fs.writeFileSync("demo.html", html);
console.log(`news articles injected: ${newsCount}, order books: ${orderCount}, class icons: ${classIconCount}, class bg: ${classBgCount}, materials: ${matCount}, snapshot: ${snapshot}`);

const priced = compact.filter((c) => c.lowest).length;
const withIcon = compact.filter((c) => c.icon).length;
console.log(`injected ${compact.length} items (priced=${priced}, withIcon=${withIcon}), tags=${tagCount}, stats=${statCount} into demo.html`);
