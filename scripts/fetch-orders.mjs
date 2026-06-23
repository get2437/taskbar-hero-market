// 各アイテムの listing ページから 売り板/買い板(order book) をパースして assets/orders.json に保存。
// Steam新UIは注文板をSSR埋め込みするので nameid 不要。価格はJPY整数。
import fs from "node:fs";

const APP = 3678970;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const yen = (s) => { const c = String(s).replace(/[^0-9.]/g, ""); const n = Math.round(parseFloat(c)); return Number.isFinite(n) ? n : null; };

function parseTable(tbl) {
  const rows = [...tbl.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])));
  const out = [];
  for (const r of rows) {
    if (r.length < 2) continue;
    const priceText = r[0];
    if (/価格|Price/i.test(priceText)) continue; // ヘッダ
    const price = yen(priceText);
    if (price == null) continue;
    const note = /以上|\+|or more/i.test(priceText) ? "more" : /以下|or fewer|or less/i.test(priceText) ? "less" : "";
    const qty = parseInt(String(r[1]).replace(/[^0-9]/g, ""), 10) || 0;
    out.push({ price, qty, note });
  }
  return out;
}

async function fetchOrders(hash, tries = 0) {
  try {
    const r = await fetch(`https://steamcommunity.com/market/listings/${APP}/${encodeURIComponent(hash)}`, { headers: { "User-Agent": UA, Cookie: "Steam_Language=japanese; steamCountry=JP%7C" } });
    if (r.status === 429 && tries < 4) { await sleep(5000 * (tries + 1)); return fetchOrders(hash, tries + 1); }
    if (!r.ok) return null;
    const page = await r.text();
    const tables = [...page.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((m) => m[1]);
    if (tables.length < 1) return { sell: [], buy: [], sellCount: 0, buyCount: 0 };
    const sell = parseTable(tables[0]);
    const buy = tables[1] ? parseTable(tables[1]) : [];
    const sellCount = parseInt((strip((page.match(/[\s\S]{0,30}個出品中/) || [])[0] || "").match(/([0-9,]+)個出品中/)?.[1] || "0").replace(/,/g, ""), 10) || 0;
    const buyCount = parseInt(((page.match(/購入希望[\s\S]{0,30}?([0-9,]+)\s*件/) || [])[1] || "0").replace(/,/g, ""), 10) || 0;
    return { sell, buy, sellCount, buyCount };
  } catch { if (tries < 3) { await sleep(3000); return fetchOrders(hash, tries + 1); } return null; }
}

async function main() {
  const items = JSON.parse(fs.readFileSync("assets/market.json", "utf8"));
  const orders = fs.existsSync("assets/orders.json") ? JSON.parse(fs.readFileSync("assets/orders.json", "utf8")) : {};
  let i = 0, ok = 0;
  for (const it of items) {
    if (!orders[it.hash]) {
      const o = await fetchOrders(it.hash);
      if (o) { orders[it.hash] = o; if (o.sell.length || o.buy.length) ok++; }
      await sleep(1800);
    }
    i++;
    if (i % 5 === 0) { process.stdout.write(`\rorders ${i}/${items.length} (ok=${ok})`); fs.writeFileSync("assets/orders.json", JSON.stringify(orders)); }
  }
  fs.writeFileSync("assets/orders.json", JSON.stringify(orders));
  console.log(`\nDONE. orderbooks: ${ok}/${items.length}`);
}
main();
