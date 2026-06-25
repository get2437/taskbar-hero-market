/**
 * シードデータ生成。
 * assets/market.json (実Taskbar Heroデータ) があれば実データで投入し、
 * 無ければ合成データにフォールバックする。
 * 価格は JPY 整数円。90日の価格履歴は合成 (Steam実履歴はログイン必須のため)。
 *
 * 冪等: 既に Item があればスキップ (FORCE_SEED=true で再生成)。
 */
import { PrismaClient, type ItemType, type Part, type Grade, type ClassType } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { classify } from "../src/lib/steam/classify";
import {
  toItemDescriptionFields,
  toStatLines,
  type ParsedDescription,
} from "../src/lib/steam/descriptions";
import { runAnalysis } from "../src/lib/analysis/engine";

const prisma = new PrismaClient();
const DAY = 86_400_000;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260613);
const randInt = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

interface SourceItem {
  marketHashName: string;
  name: string;
  imageUrl: string | null;
  lowestYen: number | null;
  volume: number;
  attrs: ReturnType<typeof classify>;
  stats?: ParsedDescription | null; // 説明文由来 (assets/stats.json)
}

// JPY文字列 "¥ 1,646" / "¥ 10.58" -> 整数円
function parseYen(s: string | null | undefined): number | null {
  if (!s) return null;
  const c = s.replace(/[^0-9.]/g, "");
  if (!c) return null;
  const n = Math.round(parseFloat(c));
  return Number.isFinite(n) ? n : null;
}

function loadRealItems(): SourceItem[] | null {
  const p = join(process.cwd(), "assets", "market.json");
  if (!existsSync(p)) return null;
  const raw = JSON.parse(readFileSync(p, "utf8")) as Array<{
    name: string; hash: string; icon: string; lowest?: string | null; volume?: number;
  }>;
  const tagsPath = join(process.cwd(), "assets", "tags.json");
  const tags: Record<string, { type?: string; grade?: string; part?: string; cls?: string; level?: number }> =
    existsSync(tagsPath) ? JSON.parse(readFileSync(tagsPath, "utf8")) : {};

  const statsPath = join(process.cwd(), "assets", "stats.json");
  const stats: Record<string, ParsedDescription> =
    existsSync(statsPath) ? JSON.parse(readFileSync(statsPath, "utf8")) : {};

  const seen = new Set<string>();
  const items: SourceItem[] = [];
  for (const r of raw) {
    if (seen.has(r.hash)) continue;
    seen.add(r.hash);
    const a = classify(r.name);
    // 実タグがあれば上書き
    const rt = tags[r.hash];
    if (rt) {
      if (rt.type) a.type = (rt.type === "gear" ? "GEAR" : "MATERIAL") as ItemType;
      if (rt.grade) a.grade = rt.grade.toUpperCase() as Grade;
      a.part = (rt.part ? rt.part.toUpperCase().replace("MAINWEAPON", "MAIN_WEAPON").replace("SUBWEAPON", "SUB_WEAPON") : a.type === "GEAR" ? a.part : "NONE") as Part;
      a.classType = (rt.cls ? rt.cls.toUpperCase() : a.type === "GEAR" ? a.classType : "NONE") as ClassType;
      a.level = rt.level != null ? rt.level : a.type === "GEAR" ? a.level : null;
    }
    items.push({
      marketHashName: r.hash,
      name: r.name,
      imageUrl: r.icon ? `https://community.steamstatic.com/economy/image/${r.icon}` : null,
      lowestYen: parseYen(r.lowest),
      volume: r.volume ?? 0,
      attrs: a,
      stats: stats[r.hash] ?? null,
    });
  }
  return items;
}

// 合成フォールバック
function genSynthetic(n: number): SourceItem[] {
  const GRADES: Grade[] = ["COSMIC", "DIVINE", "CELESTIAL", "BEYOND", "IMMORTAL", "ARCANA", "LEGENDARY", "RARE", "UNCOMMON", "COMMON"];
  const PARTS: Part[] = ["MAIN_WEAPON", "SUB_WEAPON", "ARMOR", "HELMET", "GLOVES", "BOOTS", "AMULET", "RING", "BRACER", "EARRING"];
  const CLASSES: ClassType[] = ["KNIGHT", "SLAYER", "HUNTER", "RANGER", "SORCERER", "PRIEST"];
  const LEVELS = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  const out: SourceItem[] = [];
  for (let k = 0; k < n; k++) {
    const gear = rand() < 0.7;
    out.push({
      marketHashName: `Synthetic Item #${k}`,
      name: `Synthetic Item #${k}`,
      imageUrl: null,
      lowestYen: randInt(10, 50000),
      volume: randInt(1, 5000),
      attrs: gear
        ? { type: "GEAR", part: PARTS[k % PARTS.length], grade: GRADES[k % GRADES.length], classType: CLASSES[k % CLASSES.length], level: LEVELS[k % LEVELS.length] }
        : { type: "MATERIAL", part: "NONE", grade: "COMMON", classType: "NONE", level: null },
    });
  }
  return out;
}

async function main() {
  const force = process.env.FORCE_SEED === "true";
  const existing = await prisma.item.count();
  if (existing > 0 && !force) {
    console.log(`[seed] ${existing} items already present — skip (FORCE_SEED=true to override).`);
    return;
  }
  if (force) {
    console.log("[seed] FORCE_SEED: wiping...");
    for (const m of [
      prisma.priceHistory, prisma.marketSnapshot, prisma.itemAnalysis, prisma.anomaly,
      prisma.itemLatest, prisma.favoriteStat, prisma.favorite, prisma.priceAlert,
    ]) {
      // @ts-expect-error dynamic model deleteMany
      await m.deleteMany();
    }
    await prisma.item.deleteMany();
  }

  const real = loadRealItems();
  const source = real ?? genSynthetic(64);
  console.log(`[seed] source = ${real ? "REAL assets/market.json" : "synthetic"} (${source.length} items)`);

  const now = Date.now();
  const DAYS = 90;

  for (const s of source) {
    const cur = s.lowestYen ?? randInt(10, 5000);
    const desc = s.stats ? toItemDescriptionFields(s.stats) : null;
    const item = await prisma.item.create({
      data: {
        marketHashName: s.marketHashName,
        name: s.name,
        imageUrl: s.imageUrl,
        type: s.attrs.type,
        part: s.attrs.part,
        grade: s.attrs.grade,
        classType: s.attrs.classType,
        // 実レベル(説明文の Requires Lv.)を優先。無ければ名前由来(多くは null)。
        level: desc?.requiredLevel ?? s.attrs.level,
        ...(desc && {
          materialCategory: desc.materialCategory,
          requiredLevel: desc.requiredLevel,
          decoSlots: desc.decoSlots,
          engraveSlots: desc.engraveSlots,
          inscriptSlots: desc.inscriptSlots,
        }),
      },
    });

    // 説明文由来のステータス行
    if (s.stats) {
      const lines = toStatLines(s.stats);
      if (lines.length) {
        await prisma.itemStatLine.createMany({ data: lines.map((l) => ({ ...l, itemId: item.id })) });
      }
    }

    // 価格履歴。既定は「今日の実価格1点」のみ(=偽の推移を作らない)。
    // デモ目的で過去の推移を埋めたい時だけ SEED_SYNTHETIC_HISTORY=true で90日ランダムウォークを生成する。
    const synthetic = process.env.SEED_SYNTHETIC_HISTORY === "true";
    const baseQty = Math.max(1, Math.round((s.volume || 30) / 30));
    const todayQty = Math.max(0, Math.round(baseQty * (0.5 + rand())));
    const history: { itemId: string; price: number; quantity: number; timestamp: Date }[] = [];
    const snapshots: any[] = [];
    if (synthetic) {
      const vol = 0.01 + rand() * 0.06;
      const trend = (rand() - 0.45) * 0.012;
      let price = Math.max(1, cur * (1 - trend * 45));
      for (let d = DAYS - 1; d >= 0; d--) {
        const shock = (rand() - 0.5) * 2 * vol;
        price = Math.max(1, Math.round(price * (1 + trend + shock)));
        const qty = Math.max(0, Math.round(baseQty * (0.5 + rand())));
        const ts = new Date(now - d * DAY);
        history.push({ itemId: item.id, price, quantity: qty, timestamp: ts });
        snapshots.push({ itemId: item.id, lowestPrice: price, highestPrice: Math.round(price * 1.1), medianPrice: price, averagePrice: price, quantity: qty, createdAt: ts });
      }
      history[history.length - 1].price = cur; // 末尾=実価格
    } else {
      // 既定: 実価格1点のみ。最高/中間/平均は実値が無いので null (捏造しない)。
      const ts = new Date(now);
      history.push({ itemId: item.id, price: cur, quantity: todayQty, timestamp: ts });
      snapshots.push({ itemId: item.id, lowestPrice: cur, highestPrice: null, medianPrice: null, averagePrice: null, quantity: todayQty, createdAt: ts });
    }

    await prisma.priceHistory.createMany({ data: history });
    await prisma.marketSnapshot.createMany({ data: snapshots });

    const change = (daysAgo: number) => {
      const base = history[history.length - 1 - daysAgo];
      return base ? Math.round(((cur - base.price) / base.price) * 10_000) : null;
    };
    await prisma.itemLatest.create({
      data: {
        itemId: item.id, lowestPrice: cur, highestPrice: synthetic ? Math.round(cur * 1.1) : null,
        medianPrice: synthetic ? cur : null, averagePrice: synthetic ? cur : null, quantity: history[history.length - 1].quantity,
        changePrev: change(1), change7d: change(7), change30d: change(30),
        fetchedAt: history[history.length - 1].timestamp,
      },
    });
    // お気に入り数は捏造しない。実ユーザーが付けた分だけ adjustFavoriteStat で増える。
    await prisma.favoriteStat.create({ data: { itemId: item.id, total: 0, last24h: 0 } });
  }

  // デモユーザー
  const user = await prisma.user.upsert({ where: { email: "demo@taskbar-hero.local" }, create: { email: "demo@taskbar-hero.local", name: "Demo Trader" }, update: {} });
  const folders = await Promise.all(
    [["買いたい", "#22c55e"], ["売却候補", "#ef4444"], ["長期保有", "#3b82f6"]].map(([name, color], i) =>
      prisma.folder.create({ data: { userId: user.id, name, color, sortOrder: i } })),
  );
  const some = await prisma.item.findMany({ take: 6, include: { latest: true } });
  for (let i = 0; i < some.length; i++) {
    await prisma.favorite.create({
      data: { userId: user.id, itemId: some[i].id, folderId: folders[i % folders.length].id, purchasePrice: some[i].latest?.lowestPrice ? Math.round(some[i].latest!.lowestPrice! * 0.8) : null },
    });
  }

  console.log("[seed] running analysis...");
  const r = await runAnalysis(now);
  console.log(`[seed] done. analyzed=${r.analyzed} anomalies=${r.anomalies}`);
}

main().catch((e) => { console.error("[seed] failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
