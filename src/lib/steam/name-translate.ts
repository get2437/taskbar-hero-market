/**
 * アイテム名を Claude API で多言語へ機械翻訳する層。
 * Steam に公式のアイテム名翻訳が無いため、英語名を各言語へ翻訳して Item.nameI18n(JSON) に保存する。
 *
 * 効率と一貫性のため、名前を「ベース名 + (レア度) + 接尾辞(A/B...)」に分解し、
 *  - ベース名だけを機械翻訳 (レア度違い・接尾辞違いで共有 → 翻訳数を大幅削減)
 *  - レア度は既存の正確な辞書(facetMessages)を流用
 *  - 接尾辞(A/B/C)はそのまま維持
 * して合成する。レア度括弧が無い名前(素材など)は全体を翻訳する。
 *
 * ANTHROPIC_API_KEY が無い環境では何もしない(英語フォールバックのまま)。
 */
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { facetMessages, LOCALES } from "@/lib/i18n/messages";
import { captureException } from "@/lib/monitoring";

// 翻訳対象は en 以外の8言語。en は原文をそのまま使う。
const TARGET_LOCALES = LOCALES.filter((l) => l !== "en");

const LANG_NAMES: Record<string, string> = {
  ja: "Japanese", ko: "Korean", zh: "Simplified Chinese", ru: "Russian",
  pt: "Portuguese", es: "Spanish", fr: "French", de: "German",
};

// レア度語 → Grade enum (facetMessages のキー)
const RARITY_WORD: Record<string, string> = {
  common: "COMMON", uncommon: "UNCOMMON", rare: "RARE", legendary: "LEGENDARY",
  arcana: "ARCANA", immortal: "IMMORTAL", beyond: "BEYOND", divine: "DIVINE",
  celestial: "CELESTIAL", cosmic: "COSMIC",
};
const RARITY_RE = new RegExp(`^(.*?)\\s*\\((${Object.keys(RARITY_WORD).join("|")})\\)\\s*(.*)$`, "i");

interface ParsedName {
  base: string;          // 翻訳対象のベース文字列
  grade: string | null;  // Grade enum (レア度括弧があれば)
  suffix: string;        // 接尾辞 (A/B/C 等)。そのまま維持
}
export function parseItemName(name: string): ParsedName {
  const m = name.match(RARITY_RE);
  if (m) return { base: m[1].trim(), grade: RARITY_WORD[m[2].toLowerCase()] ?? null, suffix: m[3].trim() };
  return { base: name.trim(), grade: null, suffix: "" };
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

const ITEM_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(TARGET_LOCALES.map((l) => [l, { type: "string" }])),
  required: [...TARGET_LOCALES],
  additionalProperties: false,
};
const BATCH_SCHEMA = {
  type: "object",
  properties: { items: { type: "array", items: ITEM_SCHEMA } },
  required: ["items"],
  additionalProperties: false,
};

const NAME_SYSTEM =
  "You localize fantasy RPG equipment/material names from English into multiple languages. " +
  "Translate each name naturally and concisely for in-game use; keep it short. " +
  "Do NOT add explanations, quotes, or trailing punctuation. Preserve any numbers. " +
  "Return exactly one object per input, in the same order.";
const STAT_SYSTEM =
  "You localize fantasy RPG item effect descriptions (special/unique stats) from English into multiple languages. " +
  "Translate each effect sentence naturally for in-game use. Preserve all numbers, percentages and symbols exactly. " +
  "Keep it concise; do NOT add explanations or quotes. Return exactly one object per input, in the same order.";

/** 文字列の配列を8言語へ翻訳。戻り値は source -> {locale: text}。失敗分は欠落。 */
async function translateBatch(sources: string[], system = NAME_SYSTEM, unit = "item names"): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  const c = getClient();
  if (!c || !sources.length) return out;
  const langs = TARGET_LOCALES.map((l) => `${l}=${LANG_NAMES[l]}`).join(", ");
  const numbered = sources.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const res = await c.messages.create({
    model: "claude-opus-4-8",
    max_tokens: Math.min(8000, 600 + sources.length * 160),
    output_config: { effort: "low", format: { type: "json_schema", schema: BATCH_SCHEMA } },
    system,
    messages: [
      {
        role: "user",
        content:
          `Translate each of the following ${sources.length} ${unit} into these locales (code=language): ${langs}.\n` +
          `Return { "items": [ {${TARGET_LOCALES.join(", ")}}, ... ] } with one entry per input in order.\n\n` +
          numbered,
      },
    ],
  });
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return out;
  let parsed: { items?: Record<string, string>[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    return out;
  }
  (parsed.items ?? []).forEach((obj, i) => {
    const src = sources[i];
    if (!src || !obj) return;
    const rec: Record<string, string> = {};
    for (const l of TARGET_LOCALES) if (typeof obj[l] === "string" && obj[l].trim()) rec[l] = obj[l].trim();
    if (Object.keys(rec).length) out.set(src, rec);
  });
  return out;
}

/** レア度語(enum)の各言語表記を facetMessages から取得。 */
function rarityLabel(grade: string, locale: string): string {
  const m = facetMessages[grade];
  return m?.[locale as keyof typeof m] ?? m?.en ?? grade;
}

/**
 * アイテム名を翻訳して Item.nameI18n に保存する。
 * onlyMissing=true なら nameI18n 未設定のものだけ。戻り値=更新できた件数/対象数。
 */
export async function translateItemNames(
  opts: { maxItems?: number; onlyMissing?: boolean; onProgress?: (current: number, total: number) => void } = {},
): Promise<{ updated: number; total: number }> {
  if (!getClient()) return { updated: 0, total: 0 }; // APIキー未設定なら何もしない
  const items = await prisma.item.findMany({
    where: { active: true, ...(opts.onlyMissing ? { nameI18n: { equals: Prisma.DbNull } } : {}) },
    select: { id: true, name: true },
    take: opts.maxItems ?? 5000,
  });
  if (!items.length) return { updated: 0, total: 0 };

  // 翻訳対象のユニーク文字列を収集 (ベース名 or 素材は全体)
  const parsedByItem = items.map((it) => ({ it, p: parseItemName(it.name) }));
  const sources = [...new Set(parsedByItem.map(({ p }) => p.base))];

  // バッチ翻訳
  const srcMap = new Map<string, Record<string, string>>();
  const BATCH = 40;
  let translated = 0;
  for (let i = 0; i < sources.length; i += BATCH) {
    const batch = sources.slice(i, i + BATCH);
    try {
      const m = await translateBatch(batch);
      for (const [k, v] of m) srcMap.set(k, v);
    } catch (e) {
      captureException(e, { source: "jobs/translateNames/batch", level: "warning" });
    }
    translated += batch.length;
    opts.onProgress?.(translated, sources.length);
  }

  // 各アイテムの nameI18n を合成して保存
  let updated = 0;
  for (const { it, p } of parsedByItem) {
    const baseTr = srcMap.get(p.base);
    if (!baseTr) continue;
    const nameI18n: Record<string, string> = {};
    for (const l of TARGET_LOCALES) {
      const b = baseTr[l];
      if (!b) continue;
      nameI18n[l] = p.grade
        ? `${b} (${rarityLabel(p.grade, l)})${p.suffix ? " " + p.suffix : ""}`
        : b;
    }
    if (Object.keys(nameI18n).length) {
      try {
        await prisma.item.update({ where: { id: it.id }, data: { nameI18n: nameI18n as object } });
        updated++;
      } catch (e) {
        captureException(e, { source: "jobs/translateNames/save", level: "warning" });
      }
    }
  }
  return { updated, total: items.length };
}

/**
 * 特殊(Unique)ステータスの効果文を翻訳して ItemStatLine.labelI18n に保存する。
 * 同じ効果文は複数アイテムで共有されるため、ユニークなラベルだけ翻訳して一括反映する。
 * onlyMissing=true なら labelI18n 未設定の行だけ対象。戻り値=更新行数/対象ユニーク文数。
 */
export async function translateStatLines(
  opts: { onlyMissing?: boolean; onProgress?: (current: number, total: number) => void } = {},
): Promise<{ updated: number; total: number }> {
  if (!getClient()) return { updated: 0, total: 0 };
  // 翻訳が必要なユニークな効果文を収集 (kind=SPECIAL のみ)
  const groups = await prisma.itemStatLine.groupBy({
    by: ["label"],
    where: { kind: "SPECIAL", ...(opts.onlyMissing ? { labelI18n: { equals: Prisma.DbNull } } : {}) },
    _count: { _all: true },
  });
  const labels = groups.map((g) => g.label).filter((l) => l && l.trim().length > 1);
  if (!labels.length) return { updated: 0, total: 0 };

  const trMap = new Map<string, Record<string, string>>();
  const BATCH = 30;
  let done = 0;
  for (let i = 0; i < labels.length; i += BATCH) {
    const batch = labels.slice(i, i + BATCH);
    try {
      const m = await translateBatch(batch, STAT_SYSTEM, "item effect descriptions");
      for (const [k, v] of m) trMap.set(k, v);
    } catch (e) {
      captureException(e, { source: "jobs/translateStats/batch", level: "warning" });
    }
    done += batch.length;
    opts.onProgress?.(done, labels.length);
  }

  // 同一 label の行すべてに labelI18n を反映
  let updated = 0;
  for (const [label, tr] of trMap) {
    try {
      const res = await prisma.itemStatLine.updateMany({
        where: { kind: "SPECIAL", label },
        data: { labelI18n: tr as object },
      });
      updated += res.count;
    } catch (e) {
      captureException(e, { source: "jobs/translateStats/save", level: "warning" });
    }
  }
  return { updated, total: labels.length };
}
