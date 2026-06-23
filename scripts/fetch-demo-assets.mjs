// Taskbar Hero (appid 3678970) の実マーケットから 全アイテムの
// 名前・アイコン・出品数・JPY価格(lowest/median/volume) を取得して
// assets/market.json に保存する。デモHTML生成の素材。
import fs from "node:fs";

const APP = 3678970;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 0) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (r.status === 429 && tries < 4) { await sleep(4000 * (tries + 1)); return getJson(url, tries + 1); }
    if (!r.ok) return null;
    return await r.json();
  } catch { if (tries < 3) { await sleep(3000); return getJson(url, tries + 1); } return null; }
}

async function main() {
  // 1) 一覧 (10件/ページ固定)
  const items = [];
  let start = 0, total = Infinity;
  while (start < total) {
    const d = await getJson(`https://steamcommunity.com/market/search/render/?appid=${APP}&norender=1&count=100&start=${start}&currency=8`);
    if (!d || !d.results) break;
    total = d.total_count;
    for (const x of d.results) {
      items.push({
        name: x.name,
        hash: x.hash_name,
        listings: x.sell_listings || 0,
        icon: x.asset_description?.icon_url || "",
      });
    }
    process.stdout.write(`\rlist ${items.length}/${total}`);
    start += 10;
    await sleep(1500);
  }
  console.log(`\nlisted ${items.length} items`);

  // 2) 各アイテムの JPY 価格
  let i = 0;
  for (const it of items) {
    const d = await getJson(`https://steamcommunity.com/market/priceoverview/?appid=${APP}&currency=8&market_hash_name=${encodeURIComponent(it.hash)}`);
    if (d && d.success) {
      it.lowest = d.lowest_price || null;
      it.median = d.median_price || null;
      it.volume = d.volume ? parseInt(String(d.volume).replace(/[^0-9]/g, ""), 10) || 0 : 0;
    }
    i++;
    if (i % 10 === 0) {
      process.stdout.write(`\rprice ${i}/${items.length}`);
      fs.writeFileSync("assets/market.json", JSON.stringify(items, null, 1)); // 途中保存
    }
    await sleep(2200);
  }
  fs.writeFileSync("assets/market.json", JSON.stringify(items, null, 1));
  const withPrice = items.filter((x) => x.lowest).length;
  console.log(`\nDONE. items=${items.length} withPrice=${withPrice}`);
}
main();
