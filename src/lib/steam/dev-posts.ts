/**
 * Steam コミュニティ掲示板 (discussions) の「開発者が立てたスレッド」を取得する層。
 * 一覧から開発者(ピン留めスレッドのOP=開発者)が立てたスレッドを特定し、本文ページで
 * 開発者バッジ(commentthread_author_developer)を確認したものだけを NewsArticle(source="forum")
 * として保存する。以降の翻訳/表示はニュースと同じパイプラインに乗る。
 *
 * ※ Steam に掲示板の公開APIは無いため HTML をスクレイプする。構造変更で壊れうるが、
 *   失敗してもジョブ全体は止めない設計。
 */
import { prisma } from "@/lib/prisma";
import { steamFetch } from "./http";

const APP_ID = Number(process.env.STEAM_APP_ID ?? 3678970);
const BASE = "https://steamcommunity.com/app";
const INTERVAL = Number(process.env.STEAM_REQUEST_INTERVAL_MS ?? 3500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function strip(s: string): string {
  return decodeEntities(
    s.replace(/\[\/?[^\]]+\]/g, "").replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ThreadEntry {
  gid: string;
  url: string;
  title: string;
  opName: string;
  pinned: boolean;
}

/** 掲示板一覧HTMLからスレッド一覧(gid/URL/タイトル/OP名/ピン)を抽出する。 */
export function parseThreadList(html: string): ThreadEntry[] {
  const out: ThreadEntry[] = [];
  const parts = html.split('data-gidforumtopic="');
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const gid = seg.match(/^(\d+)/)?.[1];
    if (!gid) continue;
    // class(=sticky判定)は gid の直前(前パーツの末尾)にある
    const pinned = /forum_topic[^"]*\bsticky\b/.test(parts[i - 1].slice(-300));
    const tip = decodeEntities(seg.match(/data-tooltip-forum="([^"]*)"/)?.[1] ?? "");
    const opName = tip.match(/Posted by:\s*<span[^>]*>([^<]+)</i)?.[1]?.trim() ?? "";
    // URL はスクレイプせず gid から組み立てる (href は末尾が欠ける場合があるため確実なこちらを使う)
    const url = `${BASE}/${APP_ID}/discussions/0/${gid}/`;
    const title = strip(seg.match(/forum_topic_name[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "")
      .replace(/^PINNED:\s*/i, "")
      .trim();
    if (gid && title) out.push({ gid, url, title, opName, pinned });
  }
  return out;
}

/**
 * スレッド本文ページから OP 投稿の本文・日時・開発者判定を取り出す。
 * 本文は og:description (=OPの先頭投稿テキスト) を使う。DOM構造より安定して取れる。
 * 開発者判定は開発者バッジ(commentthread_author_developer)、日時は先頭の data-timestamp(=OP)。
 */
export function extractOpPost(html: string): { isDev: boolean; ts: number; content: string } | null {
  const isDev = /commentthread_author_developer/.test(html);
  const ts = Number(html.match(/data-timestamp="(\d+)"/)?.[1] ?? 0);
  const desc =
    html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1] ??
    html.match(/<meta name="Description" content="([^"]*)"/i)?.[1] ??
    "";
  const content = strip(desc);
  if (!content) return null;
  return { isDev, ts: ts || Math.floor(Date.now() / 1000), content };
}

/**
 * 開発者が立てたスレッドを取得して NewsArticle(source="forum") に upsert する。戻り値=件数。
 * 開発者名はピン留めスレッドのOP(=開発者)から自動判定。STEAM_DEV_NAMES でも補える。
 */
export async function fetchDevPosts(maxThreads = 12): Promise<number> {
  let listRes: Response;
  try {
    listRes = await steamFetch(`${BASE}/${APP_ID}/discussions/0/?l=english`, {
      retries: 2,
      headers: { Cookie: "Steam_Language=english" },
    });
  } catch {
    return 0;
  }
  if (!listRes.ok) return 0;
  const threads = parseThreadList(await listRes.text());
  if (!threads.length) return 0;

  // 開発者名 = 環境変数 + ピン留めスレッドのOP
  const envNames = (process.env.STEAM_DEV_NAMES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const devNames = new Set<string>([...envNames, ...threads.filter((t) => t.pinned && t.opName).map((t) => t.opName.toLowerCase())]);
  if (!devNames.size) return 0;

  const candidates = threads.filter((t) => t.opName && devNames.has(t.opName.toLowerCase())).slice(0, maxThreads);

  let n = 0;
  for (const th of candidates) {
    try {
      const r = await steamFetch(th.url, { retries: 2, headers: { Cookie: "Steam_Language=english" } });
      if (!r.ok) continue;
      const op = extractOpPost(await r.text());
      if (!op || !op.isDev) continue; // 開発者バッジで最終確認
      await prisma.newsArticle.upsert({
        where: { gid: `forum_${th.gid}` },
        create: {
          gid: `forum_${th.gid}`,
          source: "forum",
          title: th.title,
          contents: op.content.slice(0, 4000),
          url: th.url,
          feedLabel: "Developer",
          publishedAt: new Date(op.ts * 1000),
        },
        update: {
          title: th.title,
          contents: op.content.slice(0, 4000),
          url: th.url,
          feedLabel: "Developer",
          publishedAt: new Date(op.ts * 1000),
          fetchedAt: new Date(),
        },
      });
      n++;
    } catch {
      /* 1件失敗してもジョブは止めない */
    }
    await sleep(INTERVAL);
  }
  return n;
}
