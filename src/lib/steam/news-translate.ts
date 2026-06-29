/**
 * Steamニュース(英語原文)を Claude API で多言語へ自動翻訳する層。
 * 翻訳の無い記事だけを対象に、タイトル＋要約を8言語へ翻訳して translations(JSON)へ保存する。
 * ANTHROPIC_API_KEY が無い環境では何もしない(英語フォールバックのまま)。
 */
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NEWS_LOCALES, type NewsTranslations } from "./news";
import { captureException } from "@/lib/monitoring";

const LANG_NAMES: Record<string, string> = {
  ja: "Japanese", ko: "Korean", zh: "Simplified Chinese", ru: "Russian",
  pt: "Portuguese", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pl: "Polish", tr: "Turkish", th: "Thai", vi: "Vietnamese",
};

// 構造化出力用の JSON Schema (各言語に title/summary)。
const PAIR_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, summary: { type: "string" } },
  required: ["title", "summary"],
  additionalProperties: false,
};
const TRANSLATION_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(NEWS_LOCALES.map((l) => [l, PAIR_SCHEMA])),
  required: [...NEWS_LOCALES],
  additionalProperties: false,
};

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

/** 1記事を8言語へ翻訳。失敗時は null。 */
async function translateOne(title: string, contents: string): Promise<NewsTranslations | null> {
  const c = getClient();
  if (!c) return null;
  const langs = NEWS_LOCALES.map((l) => `${l}=${LANG_NAMES[l]}`).join(", ");
  const body = contents.slice(0, 3000);
  const res = await c.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: TRANSLATION_SCHEMA } },
    system:
      "You are a professional game-news localizer. Translate the given English game announcement " +
      "into the requested languages. Keep proper nouns and game/feature names natural for each locale. " +
      "The summary must be a concise 1-2 sentence gist (not a full translation), suitable for a news card.",
    messages: [
      {
        role: "user",
        content:
          `Translate into these locales (code=language): ${langs}.\n\n` +
          `For each locale return { title, summary }.\n\n` +
          `TITLE:\n${title}\n\nBODY:\n${body}`,
      },
    ],
  });
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return null;
  let parsed: Record<string, { title?: string; summary?: string }>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const out: NewsTranslations = {};
  for (const l of NEWS_LOCALES) {
    const p = parsed[l];
    if (p?.title && p?.summary) out[l] = { title: p.title, summary: p.summary };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * 翻訳がまだ無い記事を翻訳して保存する。worker から fetchNews の後に呼ぶ。
 * 1件失敗してもジョブ全体は止めない。戻り値=翻訳できた件数。
 */
export async function translatePendingNews(maxArticles = 20): Promise<number> {
  if (!getClient()) return 0; // APIキー未設定なら何もしない
  const rows = await prisma.newsArticle.findMany({
    where: { translations: { equals: Prisma.DbNull } },
    orderBy: { publishedAt: "desc" },
    take: maxArticles,
    select: { gid: true, title: true, contents: true },
  });
  let done = 0;
  for (const r of rows) {
    try {
      const tr = await translateOne(r.title, r.contents);
      if (tr) {
        await prisma.newsArticle.update({ where: { gid: r.gid }, data: { translations: tr as object } });
        done++;
      }
    } catch (e) {
      captureException(e, { source: "jobs/translateNews/item", level: "warning" });
    }
  }
  return done;
}
