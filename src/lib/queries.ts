/**
 * 画面/APIから使うデータアクセス層。Prisma クエリを一箇所に集約する。
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { facetMessages } from "@/lib/i18n/messages";

// ---------------------------------------------------------------------------
// アイテム一覧 (検索 / 絞り込み / ソート / ページング)
// ---------------------------------------------------------------------------

export interface ItemListParams {
  q?: string;
  priceMin?: number;
  priceMax?: number;
  types?: string[];
  parts?: string[];
  grades?: string[];
  classes?: string[];
  levelMin?: number;
  levelMax?: number;
  // 説明文由来の絞り込み
  matCategories?: string[];          // 素材サブ分類 (DECORATION 等)
  reqLevelMin?: number;              // 必要レベル
  reqLevelMax?: number;
  statKeys?: string[];               // ステータスキー (チップ選択)。複数=全て持つ(AND)
  statKind?: string;                 // 対象種別 (BASE/INHERENT/SPECIAL/MATERIAL_EFFECT)。未指定=種別不問
  withUnique?: boolean;             // 特殊ステータス(Unique)を持つものだけ
  sort?: "price" | "quantity" | "level" | "name" | "score" | "change7d";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const SORTABLE = new Set(["price", "quantity", "level", "name", "score", "change7d"]);

// enum許可リスト (不正値はPrismaがエラーになるため事前にサニタイズ)
const VALID_TYPE = new Set(["GEAR", "MATERIAL"]);
const VALID_GRADE = new Set(["COSMIC", "DIVINE", "CELESTIAL", "BEYOND", "IMMORTAL", "ARCANA", "LEGENDARY", "RARE", "UNCOMMON", "COMMON"]);
const VALID_PART = new Set(["MAIN_WEAPON", "SUB_WEAPON", "ARMOR", "HELMET", "GLOVES", "BOOTS", "AMULET", "RING", "BRACER", "EARRING", "NONE"]);
const VALID_CLASS = new Set(["KNIGHT", "SLAYER", "HUNTER", "RANGER", "SORCERER", "PRIEST", "NONE"]);
const VALID_MATCAT = new Set(["DECORATION", "ENGRAVING", "INSCRIPTION", "CRAFTING", "SOULSTONE", "NONE"]);
const VALID_STATKIND = new Set(["BASE", "INHERENT", "SPECIAL", "MATERIAL_EFFECT"]);
const onlyValid = (arr: string[] | undefined, set: Set<string>) => (arr ?? []).filter((v) => set.has(v));
const clampInt = (v: number | undefined, lo: number, hi: number) => (v == null || !Number.isFinite(v) ? undefined : Math.min(hi, Math.max(lo, Math.trunc(v))));
const sanitizeKey = (s: string | undefined) => (s ? s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 60) : "");

// ---------------------------------------------------------------------------
// 多言語検索: ファセット(種別/グレード/部位/クラス/素材分類)の各言語ラベルから
// enum 値を逆引きする索引。検索語がどの言語でも該当アイテムにヒットさせる
// (表示名は英語のまま変えない)。
// ---------------------------------------------------------------------------
type FacetField = "type" | "grade" | "part" | "classType" | "materialCategory";
const FACET_FIELDS: Record<FacetField, Set<string>> = {
  type: VALID_TYPE,
  grade: VALID_GRADE,
  part: new Set(["MAIN_WEAPON", "SUB_WEAPON", "ARMOR", "HELMET", "GLOVES", "BOOTS", "AMULET", "RING", "BRACER", "EARRING"]),
  classType: new Set(["KNIGHT", "SLAYER", "HUNTER", "RANGER", "SORCERER", "PRIEST"]),
  materialCategory: new Set(["DECORATION", "ENGRAVING", "INSCRIPTION", "CRAFTING", "SOULSTONE"]),
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// { field -> [ { label(正規化), enum } ... ] }
const FACET_INDEX: Record<FacetField, { label: string; value: string }[]> = (() => {
  const idx = { type: [], grade: [], part: [], classType: [], materialCategory: [] } as Record<
    FacetField,
    { label: string; value: string }[]
  >;
  for (const field of Object.keys(FACET_FIELDS) as FacetField[]) {
    for (const value of FACET_FIELDS[field]) {
      const m = facetMessages[value];
      if (!m) continue;
      for (const label of Object.values(m)) {
        const n = norm(label);
        if (n && n !== "—" && !idx[field].some((e) => e.label === n && e.value === value)) {
          idx[field].push({ label: n, value });
        }
      }
    }
  }
  return idx;
})();

/**
 * 検索語をファセット enum へ展開する。語(全体および空白区切りの各トークン)が
 * いずれかの言語のラベルと一致/部分一致すれば、その enum を該当フィールドに加える。
 */
function expandSearchToFacets(q: string): Partial<Record<FacetField, string[]>> {
  const tokens = [norm(q), ...norm(q).split(" ")].filter((t) => t.length >= 1);
  const out: Partial<Record<FacetField, Set<string>>> = {};
  for (const field of Object.keys(FACET_INDEX) as FacetField[]) {
    for (const { label, value } of FACET_INDEX[field]) {
      const hit = tokens.some((tok) => (tok.length >= 2 ? label.includes(tok) || tok.includes(label) : label === tok));
      if (hit) (out[field] ??= new Set()).add(value);
    }
  }
  const res: Partial<Record<FacetField, string[]>> = {};
  for (const field of Object.keys(out) as FacetField[]) res[field] = [...out[field]!];
  return res;
}

export async function listItems(params: ItemListParams) {
  const page = Math.max(1, clampInt(params.page, 1, 100000) ?? 1);
  const pageSize = Math.min(100, Math.max(1, clampInt(params.pageSize, 1, 100) ?? 24));
  const sort = SORTABLE.has(params.sort ?? "") ? params.sort! : "quantity";
  const order: "asc" | "desc" = params.order === "asc" ? "asc" : "desc";

  const types = onlyValid(params.types, VALID_TYPE);
  const parts = onlyValid(params.parts, VALID_PART);
  const grades = onlyValid(params.grades, VALID_GRADE);
  const classes = onlyValid(params.classes, VALID_CLASS);
  const priceMin = clampInt(params.priceMin, 0, 1e12);
  const priceMax = clampInt(params.priceMax, 0, 1e12);
  const levelMin = clampInt(params.levelMin, 1, 999);
  const levelMax = clampInt(params.levelMax, 1, 999);
  const matCategories = onlyValid(params.matCategories, VALID_MATCAT);
  const reqLevelMin = clampInt(params.reqLevelMin, 1, 999);
  const reqLevelMax = clampInt(params.reqLevelMax, 1, 999);
  const statKeys = (params.statKeys ?? []).map(sanitizeKey).filter(Boolean).slice(0, 8);
  const statKind = VALID_STATKIND.has(params.statKind ?? "") ? params.statKind! : undefined;

  const where: Prisma.ItemWhereInput = { active: true };
  if (params.q) {
    const q = params.q.slice(0, 100);
    // 英語名の部分一致 OR 多言語ファセット展開(部位/グレード/クラス/種別/素材分類)。
    // 例: "靴"/"Boots"→part=BOOTS、"アルカナ"→grade=ARCANA、"ナイト"→class=KNIGHT。
    const ex = expandSearchToFacets(q);
    const facetAnd: Prisma.ItemWhereInput[] = [];
    if (ex.type?.length) facetAnd.push({ type: { in: ex.type as any } });
    if (ex.grade?.length) facetAnd.push({ grade: { in: ex.grade as any } });
    if (ex.part?.length) facetAnd.push({ part: { in: ex.part as any } });
    if (ex.classType?.length) facetAnd.push({ classType: { in: ex.classType as any } });
    if (ex.materialCategory?.length) facetAnd.push({ materialCategory: { in: ex.materialCategory as any } });
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, ...(facetAnd.length ? [{ AND: facetAnd }] : [])];
  }
  if (types.length) where.type = { in: types as any };
  if (parts.length) where.part = { in: parts as any };
  if (grades.length) where.grade = { in: grades as any };
  if (classes.length) where.classType = { in: classes as any };
  if (matCategories.length) where.materialCategory = { in: matCategories as any };
  if (levelMin != null || levelMax != null) {
    where.level = {};
    if (levelMin != null) where.level.gte = levelMin;
    if (levelMax != null) where.level.lte = levelMax;
  }
  if (reqLevelMin != null || reqLevelMax != null) {
    where.requiredLevel = {};
    if (reqLevelMin != null) where.requiredLevel.gte = reqLevelMin;
    if (reqLevelMax != null) where.requiredLevel.lte = reqLevelMax;
  }
  if (priceMin != null || priceMax != null) {
    const lp: Prisma.IntFilter = {};
    if (priceMin != null) lp.gte = priceMin;
    if (priceMax != null) lp.lte = priceMax;
    where.latest = { lowestPrice: lp };
  }
  // ステータス系の絞り込みは各条件を独立した statLines.some として AND で合成する
  // (1つの some に混ぜると「1行が全条件を同時に満たす」誤った意味になるため)
  const statConds: Prisma.ItemWhereInput[] = [];
  for (const statKey of statKeys) {
    const line: Prisma.ItemStatLineWhereInput = { statKey };
    if (statKind) line.kind = statKind as any;
    statConds.push({ statLines: { some: line } });
  }
  if (params.withUnique) statConds.push({ statLines: { some: { kind: "SPECIAL" } } });
  if (statConds.length) where.AND = statConds;

  // ソート: latest/analysis のリレーション項目は orderBy ネストで対応
  let orderBy: Prisma.ItemOrderByWithRelationInput;
  switch (sort) {
    case "price":
      orderBy = { latest: { lowestPrice: order } };
      break;
    case "quantity":
      orderBy = { latest: { quantity: order } };
      break;
    case "change7d":
      orderBy = { latest: { change7d: order } };
      break;
    case "score":
      orderBy = { analysis: { investmentScore: order } };
      break;
    case "level":
      orderBy = { level: order };
      break;
    case "name":
      orderBy = { name: order };
      break;
    default:
      orderBy = { latest: { quantity: order } };
  }

  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { latest: true, analysis: true },
    }),
  ]);

  return {
    items: items.map(serializeItemRow),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function serializeItemRow(it: Prisma.ItemGetPayload<{ include: { latest: true; analysis: true } }>) {
  return {
    id: it.id,
    name: it.name,
    marketHashName: it.marketHashName,
    imageUrl: it.imageUrl,
    type: it.type,
    part: it.part,
    grade: it.grade,
    classType: it.classType,
    level: it.level,
    lowestPrice: it.latest?.lowestPrice ?? null,
    medianPrice: it.latest?.medianPrice ?? null,
    quantity: it.latest?.quantity ?? 0,
    changePrev: it.latest?.changePrev ?? null,
    change7d: it.latest?.change7d ?? null,
    change30d: it.latest?.change30d ?? null,
    investmentScore: it.analysis?.investmentScore ?? null,
    recommendation: it.analysis?.recommendation ?? null,
    riskLevel: it.analysis?.riskLevel ?? null,
    trend: it.analysis?.trend ?? null,
    fetchedAt: it.latest?.fetchedAt ?? null,
  };
}

export type ItemRow = ReturnType<typeof serializeItemRow>;

// ---------------------------------------------------------------------------
// アイテム詳細 / 価格推移
// ---------------------------------------------------------------------------

export async function getItemDetail(id: string) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      latest: true,
      analysis: true,
      favoriteCount: true,
      statLines: { orderBy: [{ kind: "asc" }, { appliesTo: "asc" }] },
    },
  });
  if (!item) return null;
  return item;
}

/**
 * 装備ステータス表(攻略用)。全装備の基礎+固有ステータスをマップ化して返す。
 * 同一キーは基礎(BASE)を優先(その装備の主要値)。
 */
export async function getGearTable() {
  const items = await prisma.item.findMany({
    where: { active: true, type: "GEAR", statLines: { some: { kind: { in: ["BASE", "INHERENT"] } } } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      grade: true,
      part: true,
      classType: true,
      level: true,
      latest: { select: { lowestPrice: true, fetchedAt: true } },
      statLines: {
        where: { kind: { in: ["BASE", "INHERENT", "SPECIAL"] } },
        select: { statKey: true, valueMin: true, valueMax: true, unit: true, kind: true, label: true },
      },
    },
  });
  // 「現在出品中」判定: 最新取得ラウンド(全装備の最大 fetchedAt)を基準に、
  // そこから猶予以内に取得できた装備=出品中。猶予より古い=出品が消えた(最終売買価格を保持表示)。
  // ※ 市場取得が止まると基準も古くなるため、相対比較で誤検知を防ぐ。
  const graceMs = Number(process.env.GEAR_LISTED_GRACE_MIN ?? 60) * 60_000;
  let lastRound = 0;
  for (const it of items) {
    const t = it.latest?.fetchedAt?.getTime();
    if (t && t > lastRound) lastRound = t;
  }
  return items.map((it) => {
    const fetchedAt = it.latest?.fetchedAt ?? null;
    const listed = fetchedAt != null && lastRound > 0 && lastRound - fetchedAt.getTime() <= graceMs;
    const stats: Record<string, { v: number | null; unit: string }> = {};
    for (const l of it.statLines)
      if (l.kind === "BASE" && !(l.statKey in stats)) stats[l.statKey] = { v: l.valueMin, unit: l.unit };
    for (const l of it.statLines)
      if (l.kind !== "SPECIAL" && !(l.statKey in stats)) stats[l.statKey] = { v: l.valueMin, unit: l.unit };
    // 特殊ステータス (Unique Mod) — アイテム固有なので列ではなく一覧で持つ
    const specials = it.statLines
      .filter((l) => l.kind === "SPECIAL")
      .map((l) => ({ key: l.statKey, label: l.label, vMin: l.valueMin, vMax: l.valueMax, unit: l.unit }));
    return {
      id: it.id,
      name: it.name,
      imageUrl: it.imageUrl,
      grade: it.grade,
      part: it.part,
      classType: it.classType,
      level: it.level,
      lowestPrice: it.latest?.lowestPrice ?? null,
      listed,
      stats,
      specials,
    };
  });
}
export type GearRow = Awaited<ReturnType<typeof getGearTable>>[number];

/** 比較用: 指定アイテム(最大8件)のステータス行と基本情報を返す。 */
export async function getItemsForCompare(ids: string[]) {
  const clean = (ids ?? []).filter((x) => typeof x === "string").slice(0, 8);
  if (!clean.length) return [];
  const items = await prisma.item.findMany({
    where: { id: { in: clean } },
    select: {
      id: true,
      name: true,
      grade: true,
      materialCategory: true,
      requiredLevel: true,
      latest: { select: { lowestPrice: true } },
      statLines: {
        select: { kind: true, statKey: true, label: true, valueMin: true, valueMax: true, unit: true, tier: true, appliesTo: true },
      },
    },
  });
  // 呼び出し側(ids)の順序を保つ
  const byId = new Map(items.map((it) => [it.id, it]));
  return clean.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * フィルタUIのドロップダウン用: 出現するステータスキー一覧 (種別ごと、出現数つき)。
 * 重い集計ではないので呼び出し側でキャッシュ推奨。
 */
export async function getStatKeys(): Promise<
  { kind: string; statKey: string; label: string; unit: string; count: number }[]
> {
  const rows = await prisma.itemStatLine.groupBy({
    by: ["kind", "statKey", "label", "unit"],
    _count: { _all: true },
    orderBy: [{ kind: "asc" }, { statKey: "asc" }],
  });
  return rows.map((r) => ({
    kind: r.kind,
    statKey: r.statKey,
    label: r.label,
    unit: r.unit,
    count: r._count._all,
  }));
}

/** 関連アイテム: 同じ部位(装備) または 同グレード。出来高順に最大 limit 件。 */
export async function getRelatedItems(
  item: { id: string; type: string; part: string; grade: string },
  limit = 6,
): Promise<ItemRow[]> {
  const or: Prisma.ItemWhereInput[] =
    item.type === "GEAR" && item.part !== "NONE"
      ? [{ part: item.part as any }, { grade: item.grade as any }]
      : [{ grade: item.grade as any }, { type: item.type as any }];
  const rows = await prisma.item.findMany({
    where: { active: true, id: { not: item.id }, OR: or },
    orderBy: { latest: { quantity: "desc" } },
    take: limit,
    include: { latest: true, analysis: true },
  });
  return rows.map(serializeItemRow);
}

const RANGE_DAYS: Record<string, number | null> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export async function getPriceHistory(itemId: string, range: string) {
  const days = RANGE_DAYS[range] ?? 30;
  const where: Prisma.PriceHistoryWhereInput = { itemId };
  if (days != null) where.timestamp = { gte: new Date(Date.now() - days * 86_400_000) };
  const rows = await prisma.priceHistory.findMany({
    where,
    orderBy: { timestamp: "asc" },
    select: { price: true, quantity: true, timestamp: true },
  });
  return rows.map((r) => ({ t: r.timestamp.getTime(), price: r.price, quantity: r.quantity }));
}

export async function getRecentTrades(itemId: string, limit = 30) {
  const rows = await prisma.priceHistory.findMany({
    where: { itemId },
    orderBy: { timestamp: "desc" },
    take: limit,
    select: { price: true, quantity: true, timestamp: true },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// ダッシュボード / ランキング
// ---------------------------------------------------------------------------

export type RankingKind =
  | "gainers"      // 値上がり
  | "losers"       // 値下がり
  | "volume"       // 売買数
  | "expensive"    // 高額
  | "rare"         // レア
  | "buy"          // 今買うべき (割安)
  | "sell"         // 売り時 (割高)
  | "favorites";   // お気に入り人気

export async function getRanking(kind: RankingKind, limit = 50): Promise<ItemRow[]> {
  const base = { include: { latest: true, analysis: true }, take: limit } as const;
  let items: any[] = [];

  switch (kind) {
    case "gainers":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true, latest: { change7d: { not: null } } },
        orderBy: { latest: { change7d: "desc" } },
      });
      break;
    case "losers":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true, latest: { change7d: { not: null } } },
        orderBy: { latest: { change7d: "asc" } },
      });
      break;
    case "volume":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true },
        orderBy: { latest: { quantity: "desc" } },
      });
      break;
    case "expensive":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true, latest: { lowestPrice: { not: null } } },
        orderBy: { latest: { lowestPrice: "desc" } },
      });
      break;
    case "rare":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true, grade: { in: ["LEGENDARY", "ARCANA", "IMMORTAL", "BEYOND", "DIVINE", "CELESTIAL", "COSMIC"] } },
        // enum宣言順が希少度の高い順(COSMIC..COMMON)なので asc で最高レア先頭
        orderBy: [{ grade: "asc" }, { latest: { lowestPrice: "desc" } }],
      });
      break;
    case "buy":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true, analysis: { undervaluedRate: { gt: 0 } } },
        orderBy: [{ analysis: { undervaluedRate: "desc" } }, { analysis: { investmentScore: "desc" } }],
      });
      break;
    case "sell":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true, analysis: { overvaluedRate: { gt: 0 } } },
        orderBy: { analysis: { overvaluedRate: "desc" } },
      });
      break;
    case "favorites":
      items = await prisma.item.findMany({
        ...base,
        where: { active: true },
        orderBy: { favoriteCount: { total: "desc" } },
      });
      break;
  }
  return items.map(serializeItemRow);
}

// ---------------------------------------------------------------------------
// 市場サマリ
// ---------------------------------------------------------------------------

export async function getMarketSummary() {
  const [agg, upCount, downCount, anomalies, itemCount] = await Promise.all([
    prisma.itemLatest.aggregate({ _sum: { lowestPrice: true, quantity: true } }),
    prisma.itemLatest.count({ where: { changePrev: { gt: 0 } } }),
    prisma.itemLatest.count({ where: { changePrev: { lt: 0 } } }),
    prisma.anomaly.count({ where: { resolved: false, detectedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    prisma.item.count({ where: { active: true } }),
  ]);
  const dead = await prisma.itemLatest.count({ where: { quantity: { lte: 1 } } });
  return {
    marketCap: agg._sum.lowestPrice ?? 0,
    totalVolume: agg._sum.quantity ?? 0,
    upCount,
    downCount,
    anomalyCount: anomalies,
    itemCount,
    deadCount: dead,
  };
}

/** マーケットの最終更新時刻 (最新スナップショットの取得時刻)。データが無ければ null。 */
export async function getLastUpdated(): Promise<Date | null> {
  const row = await prisma.itemLatest.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } });
  return row?.fetchedAt ?? null;
}

export async function getAnomalies(limit = 50) {
  return prisma.anomaly.findMany({
    where: { resolved: false },
    orderBy: { detectedAt: "desc" },
    take: limit,
    include: { item: { include: { latest: true } } },
  });
}
