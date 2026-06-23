/**
 * Steam マーケットのリスティングページ HTML から、アイテムの説明文(ツールチップ)を
 * 構造化データへパースする層。
 *
 * Steam の search/render API は名前・価格・カテゴリしか返さないため、ステータス値は
 * リスティングページ (/market/listings/{appid}/{hash}) の SSR された `descriptions`
 * から取得する。説明文は多重 JSON エスケープされた BBCode 文字列で埋め込まれている。
 *
 * 取得できる情報:
 *  - グレード / 必要レベル / スロット数(装飾・彫刻・碑文)
 *  - Base Stats(基礎) / Inherent Stats(固有) / Unique Stats(特殊)
 *  - 素材サブ分類(装飾/彫刻/碑文/製作/ソウルストーン) と 素材の付与効果プリセット
 *
 * 数値は価格と同じ思想で「×100 した整数」で保持する(floatを避ける)。
 *   例: 36.9 -> 3690 / 38% -> 3800(unit=PCT) / 423 -> 42300
 */

export type StatUnit = "FLAT" | "PCT" | "TEXT";
export type EffectTarget = "WEAPON" | "ARMOR" | "ACCESSORY" | "NONE";
export type MaterialKind = "DECORATION" | "ENGRAVING" | "INSCRIPTION";
export type MaterialCategory = MaterialKind | "CRAFTING" | "SOULSTONE";

/** 値は ×100 した整数。範囲を持つ素材効果は valueMin~valueMax。単一値は valueMin のみ。 */
export interface StatValue {
  key: string;            // 正規化キー "critical_damage"
  label: string;          // 表示用ラベル "Critical Damage"
  valueMin: number | null;
  valueMax: number | null;
  unit: StatUnit;
  raw: string;            // 原文行
}

export interface MaterialEffect extends StatValue {
  target: EffectTarget;   // 武器/防具/装飾品 のどれに付与されるか
  tier: number | null;    // [T2] -> 2
}

export interface ParsedDescription {
  grade: string | null;            // "Divine" 等(末尾の " Grade" は除く)
  itemType: string | null;         // Steam type 文字列 "Tome - Lv. 65" / "Decoration Material"
  materialCategory: MaterialCategory | null;
  requiredLevel: number | null;
  slots: { decoration: number | null; engraving: number | null; inscription: number | null };
  baseStats: StatValue[];
  inherentStats: StatValue[];
  uniqueStats: StatValue[];        // 特殊。多くは TEXT(効果文)
  materialEffects: MaterialEffect[];
  flavor: string | null;           // フレーバーテキスト(検索対象外)
}

const EMPTY: ParsedDescription = {
  grade: null,
  itemType: null,
  materialCategory: null,
  requiredLevel: null,
  slots: { decoration: null, engraving: null, inscription: null },
  baseStats: [],
  inherentStats: [],
  uniqueStats: [],
  materialEffects: [],
  flavor: null,
};

/** "Critical Damage" -> "critical_damage" */
export function statKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const MAT_BY_TYPE: Record<string, MaterialCategory> = {
  "decoration material": "DECORATION",
  "engraving material": "ENGRAVING",
  "inscription material": "INSCRIPTION",
  "crafting material": "CRAFTING",
  soulstone: "SOULSTONE",
};

/**
 * リスティングページ HTML から `descriptions` 領域を取り出し、多重エスケープを解いて
 * BBCode を除去したプレーンテキストと、Steam の type 文字列を返す。
 */
function unescapeDescriptions(html: string): { text: string; itemType: string | null } {
  const start = html.indexOf("descriptions");
  if (start < 0) return { text: "", itemType: null };
  // type フィールド(配列の後)まで含めるため market_hash_name 付近まで取る
  let end = html.indexOf("market_hash_name", start);
  if (end < 0) end = Math.min(html.length, start + 4000);
  else end = Math.min(html.length, end + 200);

  let s = html.slice(start, end);
  // 多重エスケープを解除: バックスラッシュ列+n -> 改行 / バックスラッシュ列+" -> " / 残りの \ を除去
  s = s.replace(/\\{2,}n/g, "\n").replace(/\\+"/g, '"').replace(/\\/g, "");

  // type フィールド(bbcode/html 以外の最初のもの)= アイテムカテゴリ
  let itemType: string | null = null;
  for (const m of s.matchAll(/"type":"([^"]*)"/g)) {
    const v = m[1];
    if (v && v !== "bbcode" && v !== "html") {
      itemType = v;
      break;
    }
  }

  // descriptions[].value を順に連結
  const values: string[] = [];
  for (const m of s.matchAll(/"value":"([\s\S]*?)"\}/g)) values.push(m[1]);
  let text = values.join("\n");
  // BBCode を除去(ただし [T2] のような tier 表記は残す)
  text = text.replace(
    /\[\/?(?:b|i|u|color|url|h\d|list|olist|quote|code|table|tr|th|td|img|center|strike)(?:=[^\]]*)?\]/gi,
    "",
  );
  return { text, itemType };
}

// 数値トークン: 任意の +、整数/小数、任意の範囲(~)、任意の %
// 1=符号 2=下限 3=下限側% 4=上限 5=上限側%。% は下限/上限どちらに付いても PCT 判定。
const VALUE_RE = /([+\-]?)(\d+(?:\.\d+)?)(%?)(?:\s*~\s*([+\-]?\d+(?:\.\d+)?))?(%?)/;

function scale(n: string): number {
  return Math.round(parseFloat(n) * 100);
}

/**
 * 1 行のステータス文をパースする。数値を含めば {key,label,value...}、含まなければ TEXT 扱い。
 * 戻り値の tier は呼び出し側で素材効果に使う。
 */
function parseStatLine(line: string): (StatValue & { tier: number | null }) | null {
  let raw = line.trim();
  if (!raw) return null;
  raw = raw.replace(/^[-•]\s*/, "").trim(); // 行頭の "- "
  if (!raw) return null;

  // tier 表記 [T2] / 範囲 [T1-T3] (範囲は下限tierを採用)
  let tier: number | null = null;
  const tm = raw.match(/^\[T(\d+)(?:\s*-\s*T?\d+)?\]\s*/i);
  if (tm) {
    tier = parseInt(tm[1], 10);
    raw = raw.slice(tm[0].length).trim();
  }

  const vm = raw.match(VALUE_RE);
  if (!vm) {
    // 数値なし = 特殊効果の説明文(TEXT)
    return { key: statKey(raw), label: raw, valueMin: null, valueMax: null, unit: "TEXT", raw: line.trim(), tier };
  }

  const unit: StatUnit = vm[3] === "%" || vm[5] === "%" ? "PCT" : "FLAT";
  const valueMin = scale((vm[1] === "-" ? "-" : "") + vm[2]);
  const valueMax = vm[4] != null ? scale(vm[4]) : null;
  // ラベル = 数値トークンを除いた残り
  const label = raw.replace(vm[0], "").replace(/\s{2,}/g, " ").trim().replace(/^[+\-]\s*/, "");
  const cleanLabel = label || raw;
  return {
    key: statKey(cleanLabel),
    label: cleanLabel,
    valueMin,
    valueMax,
    unit,
    raw: line.trim(),
    tier,
  };
}

type Section =
  | "base"
  | "inherent"
  | "unique"
  | { effect: MaterialKind; target: EffectTarget }
  | null;

const SLOT_RE = /(Decoration|Engraving|Inscription)\s+Slot\s*[×xX]\s*(\d+)/;
const REQ_RE = /Requires?\s+Lv\.?\s*(\d+)/i;
const GRADE_RE = /^([A-Za-z]+)\s+Grade$/;
// 装飾は "Weapon Decoration Effect"、彫刻/碑文は "Weapon Engraving Effect List"(複数候補) 形式
const EFFECT_HDR_RE = /^(Weapon|Armor|Accessory)\s+(Decoration|Engraving|Inscription)\s+Effect(?:\s+List)?$/i;
// 対象なし ("Inscription Effect List" 等)
const EFFECT_HDR_NOTGT_RE = /^(Decoration|Engraving|Inscription)\s+Effect(?:\s+List)?$/i;

const TARGET_MAP: Record<string, EffectTarget> = { weapon: "WEAPON", armor: "ARMOR", accessory: "ACCESSORY" };
const KIND_MAP: Record<string, MaterialKind> = { decoration: "DECORATION", engraving: "ENGRAVING", inscription: "INSCRIPTION" };

/**
 * 改行なし1行で返る説明文に対し、既知マーカー(セクション見出し/効果リスト/効果オプション/スロット/必要Lv)
 * の前に改行を挿入して行ベースのパースを成立させる。改行ありの入力には冪等(二重改行は空行として無視される)。
 */
function ensureLineBreaks(text: string): string {
  return text
    // 効果オプション " - [T3] ..." をインラインから行頭へ
    .replace(/\s+-\s+(?=\[T\d)/g, "\n- ")
    // 効果見出し(対象あり): "Weapon Engraving Effect (List)"
    .replace(/\s+(?=(?:Weapon|Armor|Accessory)\s+(?:Decoration|Engraving|Inscription)\s+Effect\b)/g, "\n")
    // 効果見出し(対象なし): "Inscription Effect List"。対象語(Weapon/Armor/Accessory)直後では割らない(後読み)
    .replace(/(?<!(?:Weapon|Armor|Accessory))\s+(?=(?:Decoration|Engraving|Inscription)\s+Effect\s+List\b)/g, "\n")
    // ステータスセクション / スロット / 必要レベル
    .replace(/\s+(?=(?:Base Stats|Inherent Stats|Unique Stats|Special Stats)\b)/g, "\n")
    .replace(/\s+(?=(?:Decoration|Engraving|Inscription)\s+Slot\b)/g, "\n")
    .replace(/\s+(?=Requires?\s+Lv)/gi, "\n");
}

/** リスティングページ HTML を構造化説明データへパースする。 */
export function parseListingDescription(html: string): ParsedDescription {
  const { text: rawText, itemType } = unescapeDescriptions(html);
  if (!rawText) return { ...EMPTY, itemType };
  // 一部アイテムは説明文が改行なし1行で返る。既知マーカーの前で改行を補い、行ベースのパースを成立させる。
  const text = ensureLineBreaks(rawText);

  const result: ParsedDescription = {
    ...EMPTY,
    itemType,
    slots: { decoration: null, engraving: null, inscription: null },
    baseStats: [],
    inherentStats: [],
    uniqueStats: [],
    materialEffects: [],
  };
  if (itemType) result.materialCategory = MAT_BY_TYPE[itemType.toLowerCase()] ?? null;

  const flavorLines: string[] = [];
  let section: Section = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // グレード行
    const gm = line.match(GRADE_RE);
    if (gm) {
      result.grade = gm[1];
      section = null;
      continue;
    }
    // スロット行
    const sm = line.match(SLOT_RE);
    if (sm) {
      const n = parseInt(sm[2], 10);
      const which = sm[1].toLowerCase();
      if (which === "decoration") result.slots.decoration = n;
      else if (which === "engraving") result.slots.engraving = n;
      else if (which === "inscription") result.slots.inscription = n;
      section = null;
      continue;
    }
    // 必要レベル
    const rm = line.match(REQ_RE);
    if (rm) {
      result.requiredLevel = parseInt(rm[1], 10);
      section = null;
      continue;
    }
    // セクション見出し
    if (/^Base Stats$/i.test(line)) { section = "base"; continue; }
    if (/^Inherent Stats$/i.test(line)) { section = "inherent"; continue; }
    if (/^(Unique|Special)\s+Stats$/i.test(line)) { section = "unique"; continue; }
    const em = line.match(EFFECT_HDR_RE);
    if (em) {
      section = { effect: KIND_MAP[em[2].toLowerCase()], target: TARGET_MAP[em[1].toLowerCase()] };
      continue;
    }
    // 対象なしの効果見出し ("Inscription Effect List" 等) → 全対象 (NONE)
    const emn = line.match(EFFECT_HDR_NOTGT_RE);
    if (emn) {
      section = { effect: KIND_MAP[emn[1].toLowerCase()], target: "NONE" };
      continue;
    }

    // 本文行
    if (section === "unique") {
      // 特殊ステータスは効果文。数値は文章の一部なので抽出せず全文を TEXT 保持する
      const label = line.replace(/^[-•]\s*/, "").trim();
      if (label) {
        result.uniqueStats.push({
          key: statKey(label), label, valueMin: null, valueMax: null, unit: "TEXT", raw: line.trim(),
        });
      }
    } else if (section === "base" || section === "inherent") {
      const parsed = parseStatLine(line);
      if (!parsed) continue;
      const { tier: _t, ...stat } = parsed;
      if (section === "base") result.baseStats.push(stat);
      else result.inherentStats.push(stat);
    } else if (section && typeof section === "object") {
      const parsed = parseStatLine(line);
      if (!parsed) continue;
      const { tier, ...stat } = parsed;
      result.materialEffects.push({ ...stat, target: section.target, tier });
    } else {
      // セクション外の地の文 = フレーバー
      flavorLines.push(line);
    }
  }

  if (flavorLines.length) result.flavor = flavorLines.join(" ").trim();
  return result;
}

const BASE = "https://steamcommunity.com/market/listings";

/** リスティングページの URL を組み立てる。 */
export function listingUrl(appId: number, marketHashName: string): string {
  return `${BASE}/${appId}/${encodeURIComponent(marketHashName)}`;
}

/**
 * リスティングページを取得して説明文をパースする。取得失敗(404/レート制限等)は null。
 * 共通HTTP層(steamFetch)でバックオフ/タイムアウトに耐える。seed/jobs/スクリプトで共有。
 */
export async function fetchItemDescription(
  marketHashName: string,
  appId = Number(process.env.STEAM_APP_ID ?? 3678970),
): Promise<ParsedDescription | null> {
  const { steamFetch } = await import("./http");
  const res = await steamFetch(listingUrl(appId, marketHashName), {
    retries: 3,
    timeoutMs: 20_000,
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  return parseListingDescription(html);
}

// ---- DB マッピング (seed / 本番取得層で共有) ---------------------------------

export type StatLineKind = "BASE" | "INHERENT" | "SPECIAL" | "MATERIAL_EFFECT";

/** ItemStatLine 1行ぶんの素データ (itemId は呼び出し側で付与)。 */
export interface StatLineInput {
  kind: StatLineKind;
  statKey: string;
  label: string;
  valueMin: number | null;
  valueMax: number | null;
  unit: StatUnit;
  tier: number | null;
  appliesTo: EffectTarget | "NONE";
  rawText: string;
}

/** Item テーブルへ反映する説明文由来カラム。 */
export interface ItemDescriptionFields {
  materialCategory: MaterialCategory | "NONE";
  requiredLevel: number | null;
  decoSlots: number | null;
  engraveSlots: number | null;
  inscriptSlots: number | null;
}

export function toItemDescriptionFields(d: ParsedDescription): ItemDescriptionFields {
  return {
    materialCategory: d.materialCategory ?? "NONE",
    requiredLevel: d.requiredLevel,
    decoSlots: d.slots.decoration,
    engraveSlots: d.slots.engraving,
    inscriptSlots: d.slots.inscription,
  };
}

/** ParsedDescription を ItemStatLine 行配列へ変換する。 */
export function toStatLines(d: ParsedDescription): StatLineInput[] {
  const lines: StatLineInput[] = [];
  const push = (kind: StatLineKind, s: StatValue, tier: number | null, appliesTo: EffectTarget | "NONE") =>
    lines.push({
      kind, statKey: s.key, label: s.label, valueMin: s.valueMin, valueMax: s.valueMax,
      unit: s.unit, tier, appliesTo, rawText: s.raw,
    });
  for (const s of d.baseStats) push("BASE", s, null, "NONE");
  for (const s of d.inherentStats) push("INHERENT", s, null, "NONE");
  for (const s of d.uniqueStats) push("SPECIAL", s, null, "NONE");
  for (const e of d.materialEffects) push("MATERIAL_EFFECT", e, e.tier, e.target);
  return lines;
}
