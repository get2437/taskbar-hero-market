/**
 * 注文板 (売り板/買い板) のLIVE取得。
 * Steam新UIは itemordershistogram に必要な item_nameid をページに出さなくなったが、
 * listing ページに注文板テーブルを SSR で埋め込んでいるため、それを直接パースする。
 * Redis で短時間キャッシュ (既定60秒) し、Steamへの負荷とレイテンシを抑える。
 */
import { cached, redis } from "@/lib/redis";
import { publishLive } from "@/lib/live";
import { steamFetch } from "./http";

const APP_ID = Number(process.env.STEAM_APP_ID ?? 3678970);
const CURRENCY = Number(process.env.STEAM_CURRENCY ?? 8);
const FRACTION = CURRENCY === 8 || CURRENCY === 16 ? 0 : 2;

export interface OrderRow {
  /** 価格 (最小通貨単位) */
  price: number;
  qty: number;
  /** "more"=以上 / "less"=以下 / "" */
  note: "more" | "less" | "";
}
export interface OrderBook {
  sell: OrderRow[];
  buy: OrderRow[];
  sellCount: number;
  buyCount: number;
  fetchedAt: string;
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function parsePrice(s: string): number | null {
  const c = String(s).replace(/[^0-9.]/g, "");
  if (!c) return null;
  if (FRACTION === 0) return Math.round(parseFloat(c));
  return Math.round(parseFloat(c) * 100);
}

function parseTable(tbl: string): OrderRow[] {
  const rows = [...tbl.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])),
  );
  const out: OrderRow[] = [];
  for (const r of rows) {
    if (r.length < 2) continue;
    const priceText = r[0];
    if (/価格|Price|가격|价格|Цена/i.test(priceText)) continue;
    const price = parsePrice(priceText);
    if (price == null) continue;
    const note: OrderRow["note"] = /以上|\+|or more/i.test(priceText) ? "more" : /以下|or fewer|or less/i.test(priceText) ? "less" : "";
    const qty = parseInt(String(r[1]).replace(/[^0-9]/g, ""), 10) || 0;
    out.push({ price, qty, note });
  }
  return out;
}

async function fetchFromSteam(marketHashName: string): Promise<OrderBook> {
  const url = `https://steamcommunity.com/market/listings/${APP_ID}/${encodeURIComponent(marketHashName)}`;
  const empty: OrderBook = { sell: [], buy: [], sellCount: 0, buyCount: 0, fetchedAt: new Date().toISOString() };
  let res: Response;
  try {
    res = await steamFetch(url, { headers: { Cookie: "Steam_Language=english; steamCountry=JP%7C" }, retries: 2 });
  } catch (e) {
    console.warn(`[orderbook] fetch failed for "${marketHashName}": ${(e as Error).message}`);
    return empty;
  }
  if (!res.ok) return empty;
  const page = await res.text();
  const tables = [...page.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((m) => m[1]);
  if (tables.length === 0) return empty;
  const sell = parseTable(tables[0]);
  const buy = tables[1] ? parseTable(tables[1]) : [];
  const sellCount = parseInt((page.match(/([0-9,]+)\s*(?:個出品中|listed|sell orders?)/i)?.[1] || "0").replace(/,/g, ""), 10) || sell.reduce((a, r) => a + r.qty, 0);
  const buyCount = parseInt((page.match(/(?:購入希望|buy orders?)[\s\S]{0,30}?([0-9,]+)/i)?.[1] || "0").replace(/,/g, ""), 10) || buy.reduce((a, r) => a + r.qty, 0);
  return { sell, buy, sellCount, buyCount, fetchedAt: new Date().toISOString() };
}

/** 注文板を取得 (Redis 60秒キャッシュ)。 */
const cacheKey = (hash: string) => `orderbook:${APP_ID}:${hash}`;

/** 通常閲覧用 (Redis 60秒キャッシュ)。 */
export function getOrderBook(marketHashName: string): Promise<OrderBook> {
  return cached(cacheKey(marketHashName), 60, () => fetchFromSteam(marketHashName));
}

/** ホットアイテム用: キャッシュを無視して最新化し、キャッシュ更新＋SSE配信する。 */
export async function refreshOrderBook(marketHashName: string): Promise<OrderBook> {
  const book = await fetchFromSteam(marketHashName);
  if (redis) {
    try {
      await redis.set(cacheKey(marketHashName), JSON.stringify(book), "EX", 60);
    } catch {
      /* ignore */
    }
  }
  await publishLive({ type: "orderbook", hash: marketHashName, book });
  return book;
}
