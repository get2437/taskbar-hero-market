// 既存 assets/market.json の各アイテム価格を JPY(通貨8) で取り直す。
// (currency=23 は人民元だった。JPY は 8)
import fs from "node:fs";
const APP = 3678970;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const items = JSON.parse(fs.readFileSync("assets/market.json", "utf8"));

async function getJson(url, tries = 0) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (r.status === 429 && tries < 5) { await sleep(5000 * (tries + 1)); return getJson(url, tries + 1); }
    if (!r.ok) return null;
    return await r.json();
  } catch { if (tries < 3) { await sleep(3000); return getJson(url, tries + 1); } return null; }
}

let i = 0, ok = 0;
for (const it of items) {
  const d = await getJson(`https://steamcommunity.com/market/priceoverview/?appid=${APP}&currency=8&market_hash_name=${encodeURIComponent(it.hash)}`);
  if (d && d.success) {
    it.lowest = d.lowest_price || null;
    it.median = d.median_price || null;
    it.volume = d.volume ? parseInt(String(d.volume).replace(/[^0-9]/g, ""), 10) || 0 : 0;
    if (it.lowest) ok++;
  }
  i++;
  if (i % 10 === 0) { process.stdout.write(`\rJPY ${i}/${items.length} (ok=${ok})`); fs.writeFileSync("assets/market.json", JSON.stringify(items, null, 1)); }
  await sleep(2000);
}
fs.writeFileSync("assets/market.json", JSON.stringify(items, null, 1));
console.log(`\nDONE. JPY prices: ${ok}/${items.length}. sample: ${items[0].hash} = ${items[0].lowest}`);
