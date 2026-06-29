/**
 * 静的UIの全文字列を、未翻訳の言語へ機械翻訳して assets/i18n-extra.json に書き出す。
 * 手書き辞書(messages.ts / stat-i18n.json)に既にある言語はスキップし、欠けている分だけ補う。
 * 実行: ANTHROPIC_API_KEY=... npx tsx scripts/translate-ui.ts
 * 生成された assets/i18n-extra.json をコミットしてデプロイすると、全UIがその言語で表示される。
 */
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { messages, facetMessages, LOCALES } from "../src/lib/i18n/messages";
import statI18n from "../assets/stat-i18n.json";

const LANG_NAMES: Record<string, string> = {
  ja: "Japanese", ko: "Korean", zh: "Simplified Chinese", ru: "Russian", pt: "Portuguese",
  es: "Spanish", fr: "French", de: "German", it: "Italian", pl: "Polish", tr: "Turkish",
  th: "Thai", vi: "Vietnamese",
};

const SI = statI18n as { ui: Record<string, any>; stats: Record<string, any>; unique: Record<string, any> };
const EXTRA_PATH = "assets/i18n-extra.json";
const CATS = ["t", "f", "s", "su", "sq"] as const;
type Cat = (typeof CATS)[number];

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY が必要です。 例: ANTHROPIC_API_KEY=sk-... npx tsx scripts/translate-ui.ts");
  process.exit(1);
}
const client = new Anthropic();

const sourceDict = (cat: Cat): Record<string, any> =>
  cat === "t" ? messages : cat === "f" ? facetMessages : cat === "s" ? SI.stats : cat === "su" ? SI.ui : SI.unique;

const extra: Record<Cat, Record<string, Record<string, string>>> = (() => {
  const j = fs.existsSync(EXTRA_PATH) ? JSON.parse(fs.readFileSync(EXTRA_PATH, "utf8")) : {};
  for (const c of CATS) j[c] ??= {};
  return j;
})();

const SCHEMA = { type: "object", properties: { items: { type: "array", items: { type: "string" } } }, required: ["items"], additionalProperties: false };

async function translateBatch(texts: string[], locale: string): Promise<string[]> {
  const numbered = texts.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: Math.min(8000, 800 + texts.length * 120),
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system:
      `You are a professional UI localizer for a Steam Community Market analytics web app. ` +
      `Translate each English UI string into ${LANG_NAMES[locale] ?? locale}. ` +
      `Keep it concise and natural for an app UI. Preserve placeholders, numbers, %, punctuation and any {tokens} exactly. ` +
      `Do not add quotes or explanations. Return exactly one translation per input, in the same order.`,
    messages: [{ role: "user", content: `Translate these ${texts.length} UI strings:\n\n${numbered}` }],
  });
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  const items = (JSON.parse(text).items ?? []) as string[];
  return items;
}

async function main() {
  const targets = (LOCALES as readonly string[]).filter((l) => l !== "en");
  let total = 0;
  for (const locale of targets) {
    for (const cat of CATS) {
      const dict = sourceDict(cat);
      extra[cat][locale] ??= {};
      const pending = Object.entries(dict)
        .map(([k, v]) => [k, (v as any).en as string] as const)
        .filter(([k, en]) => en && en !== "—" && (dict[k]?.[locale] == null) && !extra[cat][locale][k]);
      if (!pending.length) continue;
      const BATCH = 40;
      for (let i = 0; i < pending.length; i += BATCH) {
        const chunk = pending.slice(i, i + BATCH);
        try {
          const tr = await translateBatch(chunk.map(([, en]) => en), locale);
          chunk.forEach(([k], idx) => { if (tr[idx]?.trim()) { extra[cat][locale][k] = tr[idx].trim(); total++; } });
        } catch (e) {
          console.warn(`  [${locale}/${cat}] batch failed:`, (e as Error).message);
        }
      }
      console.log(`  ${locale}/${cat}: +${Object.keys(extra[cat][locale]).length} keys`);
      fs.writeFileSync(EXTRA_PATH, JSON.stringify(extra)); // 逐次保存(途中中断に強い)
    }
  }
  fs.writeFileSync(EXTRA_PATH, JSON.stringify(extra));
  console.log(`done. translated ${total} strings into ${EXTRA_PATH}. commit & redeploy to apply.`);
}
main();
