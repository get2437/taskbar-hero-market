/**
 * Steam コミュニティマーケットからの取得層。
 *
 * 使用エンドポイント:
 *  - /market/search/render/?norender=1   … 出品一覧 (名前/hash/最安/出品数/画像/タグ)
 *  - /market/priceoverview/              … 最安・中間・出来高
 *  - /market/pricehistory/               … 売買履歴 (要ログインCookie, 任意)
 *
 * priceoverview/pricehistory はレート制限が厳しいため interval を空けて逐次取得する。
 */
import { classify, parseSteamPrice } from "./classify";
import { steamFetch } from "./http";
import { getRates } from "@/lib/fx";
import { STATIC_RATES } from "@/lib/money";

const APP_ID = Number(process.env.STEAM_APP_ID ?? 1056450);
const CURRENCY = Number(process.env.STEAM_CURRENCY ?? 8);
const INTERVAL = Number(process.env.STEAM_REQUEST_INTERVAL_MS ?? 3500);
// 小数を持たない通貨 (JPY=8, KRW=16) は0桁、それ以外は2桁
const ZERO_DECIMAL = new Set([8, 16]);
const FRACTION = ZERO_DECIMAL.has(CURRENCY) ? 0 : 2;
const BASE = "https://steamcommunity.com/market";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export const FRACTION_DIGITS = FRACTION;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchedItem {
  marketHashName: string;
  name: string;
  imageUrl: string | null;
  sellListings: number;
  lowestPrice: number | null;
  attrs: ReturnType<typeof classify>;
}

interface SearchResult {
  name: string;
  hash_name: string;
  sell_listings: number;
  sell_price: number; // 最安出品価格 (USDセント。検索APIは currency を無視し常にUSD)
  sell_price_text: string;
  asset_description?: {
    icon_url?: string;
  };
}

function iconUrl(icon?: string): string | null {
  if (!icon) return null;
  return `https://community.cloudflare.steamstatic.com/economy/image/${icon}`;
}

async function getJson(url: string): Promise<any> {
  // 指数バックオフ+ジッタ+タイムアウト (steamFetch)
  const res = await steamFetch(url, { retries: 4 });
  if (!res.ok) throw new Error(`Steam ${res.status} ${url}`);
  return res.json();
}

/**
 * マーケット検索を全ページ走査してアイテム一覧を返す。
 * 注意 (実APIで確認):
 *  - 検索APIは currency を無視し価格を常にUSD(`sell_price`=USDセント)で返す → FX で円換算して保存。
 *  - count を 100 等にしても1ページ最大10件しか返さない → start は実取得件数ぶん進める(でないと取りこぼす)。
 */
export async function searchAllItems(
  maxItems = 2000,
  onProgress?: (current: number, total: number) => void,
): Promise<FetchedItem[]> {
  const out: FetchedItem[] = [];
  let start = 0;
  // USD→JPY 換算レート (検索価格はUSD。アプリは JPY を基軸に保持)。
  const rates = await getRates().catch(() => STATIC_RATES);
  const jpyPerUsd = rates.JPY || STATIC_RATES.JPY;
  const toJpy = (usdCents: unknown): number | null => {
    const c = typeof usdCents === "number" ? usdCents : Number(usdCents);
    if (!Number.isFinite(c) || c <= 0) return null;
    return Math.round((c / 100) * jpyPerUsd);
  };

  while (out.length < maxItems) {
    const url = `${BASE}/search/render/?appid=${APP_ID}&norender=1&count=100&start=${start}&search_descriptions=0&sort_column=popular`;
    const data = await getJson(url);
    const results: SearchResult[] = data?.results ?? [];
    if (!results.length) break;

    for (const r of results) {
      out.push({
        marketHashName: r.hash_name,
        name: r.name,
        imageUrl: iconUrl(r.asset_description?.icon_url),
        sellListings: r.sell_listings ?? 0,
        lowestPrice: toJpy(r.sell_price),
        attrs: classify(r.name),
      });
    }

    const total: number = data?.total_count ?? out.length;
    onProgress?.(out.length, Math.min(total, maxItems));
    start += results.length; // 1ページの実取得件数ぶん進める (Steamは最大10件/ページ)
    if (start >= total) break;
    await sleep(INTERVAL);
  }

  return out.slice(0, maxItems);
}

export interface PriceOverview {
  lowestPrice: number | null;
  medianPrice: number | null;
  volume: number;
}

/** 個別アイテムの最安・中間・出来高。 */
export async function priceOverview(marketHashName: string): Promise<PriceOverview> {
  const url = `${BASE}/priceoverview/?appid=${APP_ID}&currency=${CURRENCY}&market_hash_name=${encodeURIComponent(marketHashName)}`;
  const data = await getJson(url);
  return {
    lowestPrice: parseSteamPrice(data?.lowest_price, FRACTION),
    medianPrice: parseSteamPrice(data?.median_price, FRACTION),
    volume: data?.volume ? parseInt(String(data.volume).replace(/[^0-9]/g, ""), 10) || 0 : 0,
  };
}

export interface HistoryPoint {
  timestamp: Date;
  price: number;
  quantity: number;
}

/**
 * 売買履歴。pricehistory は通常ログイン必須なので STEAM_LOGIN_COOKIE があるときのみ取得。
 * 取れない環境ではスナップショットの蓄積が履歴の代わりになる。
 */
export async function priceHistory(marketHashName: string): Promise<HistoryPoint[]> {
  const cookie = process.env.STEAM_LOGIN_COOKIE;
  if (!cookie) return [];
  const url = `${BASE}/pricehistory/?appid=${APP_ID}&currency=${CURRENCY}&market_hash_name=${encodeURIComponent(marketHashName)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const rows: [string, number, string][] = data?.prices ?? [];
  return rows.map(([dateStr, price, qtyStr]) => ({
    timestamp: new Date(dateStr),
    price: FRACTION === 0 ? Math.round(price) : Math.round(price * 100),
    quantity: parseInt(qtyStr, 10) || 0,
  }));
}

export const requestIntervalMs = INTERVAL;
