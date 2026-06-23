const APP = 3678970, UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const hash = process.argv[2] || "Diamond";
const page = await (await fetch(`https://steamcommunity.com/market/listings/${APP}/${encodeURIComponent(hash)}`, { headers: { "User-Agent": UA, Cookie: "Steam_Language=japanese; steamCountry=JP%7C" } })).text();

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// サマリ文 (○個出品中 / ○件以下での購入希望)
const sellHdr = strip((page.match(/開始価格[\s\S]{0,80}?個出品中/) || [])[0] || (page.match(/[\s\S]{0,40}個出品中/) || [])[0] || "");
const buyHdr = strip((page.match(/[\s\S]{0,60}での購入希望[\s\S]{0,20}件/) || [])[0] || "");
console.log("SELL header:", sellHdr);
console.log("BUY  header:", buyHdr);

// テーブルを全抽出して行をパース
const tables = [...page.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((m) => m[1]);
console.log("tables found:", tables.length);
tables.forEach((tb, ti) => {
  const rows = [...tb.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])));
  console.log(`--- table ${ti} (${rows.length} rows) ---`);
  rows.slice(0, 8).forEach((r) => console.log("   ", JSON.stringify(r)));
});
