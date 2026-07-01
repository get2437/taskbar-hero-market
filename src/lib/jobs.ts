/**
 * ジョブ・オーケストレーション。
 * 手動更新 (管理画面) と worker (15分毎) の双方から呼ばれる。
 *   1. Steam取得 (失敗/未設定ならスキップ)
 *   2. 分析エンジン実行
 *   3. 価格アラート評価 → 通知 (Web/Discord)
 */
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { getMaterials } from "@/lib/materials";
import { searchAllItems, fetchClassHashes } from "@/lib/steam/fetch";
import { storeFetched } from "@/lib/steam/store";
import { runAnalysis } from "@/lib/analysis/engine";
import { evaluateAlerts } from "@/lib/alerts";
import { fetchNews } from "@/lib/steam/news";
import { fetchDevPosts } from "@/lib/steam/dev-posts";
import { translatePendingNews } from "@/lib/steam/news-translate";
import { publishLive } from "@/lib/live";
import { getHotItemIds } from "@/lib/hot";
import { refreshOrderBook } from "@/lib/steam/orderbook";
import { fetchItemDescription, toItemDescriptionFields, toStatLines, gradeFromDescription, partFromItemType } from "@/lib/steam/descriptions";
import { captureException } from "@/lib/monitoring";
import { withLock, isLocked, STEAM_JOB_LOCK } from "@/lib/lock";

export interface RefreshResult {
  fetched: number;
  analyzed: number;
  anomalies: number;
  notified: number;
  skippedFetch: boolean;
  message: string;
  /** 他のSteamジョブが実行中でロックを取れず、丸ごとスキップした場合 true。 */
  skipped?: boolean;
}

export type ProgressFn = (p: { phase: string; current: number; total: number }) => void;

/** 取り残された RUNNING ログ(プロセス再起動/タイムアウトで更新されなかった分)を FAILED にする。 */
async function markStaleRunningLogs(olderThanMs = 20 * 60_000): Promise<void> {
  try {
    await prisma.fetchLog.updateMany({
      where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - olderThanMs) } },
      data: { status: "FAILED", message: "中断(再起動またはタイムアウトで完了が記録されませんでした)", finishedAt: new Date() },
    });
  } catch {
    /* ignore */
  }
}

/**
 * Steam取得+分析。手動(管理画面)と worker(15分毎)の双方から呼ばれる。
 * 共有ロックで直列化し、別プロセスのジョブと競合(二重取得→429)しないようにする。
 */
export async function runRefresh(opts: { fetch?: boolean; onProgress?: ProgressFn } = {}): Promise<RefreshResult> {
  const r = await withLock(STEAM_JOB_LOCK, 20 * 60, () => runRefreshLocked(opts));
  if (!r.ran) {
    return { fetched: 0, analyzed: 0, anomalies: 0, notified: 0, skippedFetch: true, skipped: true, message: "別のSteam取得/更新ジョブが実行中のためスキップしました。" };
  }
  return r.value;
}

async function runRefreshLocked(opts: { fetch?: boolean; onProgress?: ProgressFn }): Promise<RefreshResult> {
  const doFetch = opts.fetch ?? true;
  await markStaleRunningLogs();
  const log = await prisma.fetchLog.create({ data: { kind: "manual", status: "RUNNING" } });

  let fetched = 0;
  let skippedFetch = false;
  let message = "";

  try {
    if (doFetch) {
      try {
        opts.onProgress?.({ phase: "fetch", current: 0, total: 0 });
        const items = await searchAllItems(2000, (c, t) => opts.onProgress?.({ phase: "fetch", current: c, total: t }));
        if (items.length > 0) {
          opts.onProgress?.({ phase: "store", current: 0, total: items.length });
          fetched = await storeFetched(items);
        } else {
          skippedFetch = true;
          message = "Steam検索結果が空 (対象アプリにマーケットが無い可能性)。既存データで分析を実行。";
        }
      } catch (e) {
        skippedFetch = true;
        message = `Steam取得に失敗したため既存データで分析: ${(e as Error).message}`;
      }
    } else {
      skippedFetch = true;
    }

    opts.onProgress?.({ phase: "analyze", current: 0, total: 0 });
    const analysis = await runAnalysis();
    const notified = await evaluateAlerts();

    // ニュース取得 (失敗してもジョブは止めない)
    try {
      await fetchNews(10);
      // 掲示板の開発者投稿も取得 (スクレイプ。失敗しても続行)
      try {
        await fetchDevPosts(12);
      } catch (e) {
        captureException(e, { source: "jobs/devPosts", level: "warning" });
      }
      // 新着記事(ニュース+開発者投稿)を多言語へ自動翻訳 (ANTHROPIC_API_KEY 未設定なら no-op)
      await translatePendingNews();
    } catch (e) {
      captureException(e, { source: "jobs/news", level: "warning" });
    }

    await invalidate("dashboard");
    await invalidate("ranking:");
    await invalidate("items:");
    await invalidate("history:");
    await invalidate("news:");

    // リアルタイム配信: 市場更新を全クライアントへ
    await publishLive({
      type: "market",
      updatedAt: new Date().toISOString(),
      analyzed: analysis.analyzed,
      anomalies: analysis.anomalies,
    });

    await prisma.fetchLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        itemsTotal: analysis.analyzed,
        itemsOk: fetched,
        message: message || `fetched=${fetched} analyzed=${analysis.analyzed} anomalies=${analysis.anomalies} notified=${notified}`,
        finishedAt: new Date(),
      },
    });

    return { fetched, analyzed: analysis.analyzed, anomalies: analysis.anomalies, notified, skippedFetch, message };
  } catch (e) {
    captureException(e, { source: "jobs/runRefresh", level: "error" });
    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "FAILED", message: (e as Error).message, finishedAt: new Date() },
    });
    throw e;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Steam の権威的なクラスタグで Item.classType を確定する。
 * 名前推定では取りこぼす武器/サブ武器のクラスを正す(例: Crossbow/Shield)。
 * 一旦すべて NONE にしてからタグで再設定するため、古い誤クラスも一掃される。
 * 取得が不十分(合計が極端に少ない)な場合は誤って NONE 化しないよう何もしない。
 */
export async function refreshClassTags(): Promise<number> {
  const byClass = await fetchClassHashes();
  const total = Object.values(byClass).reduce((a, h) => a + h.length, 0);
  if (total < 100) return 0; // サニティ: 取得不十分なら中断(誤NONE防止)
  await prisma.item.updateMany({ where: { classType: { not: "NONE" } }, data: { classType: "NONE" } });
  let n = 0;
  for (const [cls, hashes] of Object.entries(byClass)) {
    for (let i = 0; i < hashes.length; i += 200) {
      const res = await prisma.item.updateMany({
        where: { marketHashName: { in: hashes.slice(i, i + 200) } },
        data: { classType: cls as any },
      });
      n += res.count;
    }
  }
  await invalidate("items:");
  await invalidate("dashboard");
  return n;
}

/**
 * 閲覧中(ホット)アイテムの注文板を優先的に最新化し、SSEで配信する。
 * worker から高頻度(例:20秒毎)に呼ぶ。Steamレート制限を守るため件数/間隔を制限。
 */
export async function refreshHotOrderBooks(maxItems = 8): Promise<number> {
  // 重いSteamジョブ(取得/説明文)実行中は、注文板取得を控えてSteam負荷の競合を避ける。
  if (await isLocked(STEAM_JOB_LOCK)) return 0;
  const ids = await getHotItemIds(maxItems);
  if (ids.length === 0) return 0;
  const items = await prisma.item.findMany({ where: { id: { in: ids } }, select: { marketHashName: true } });
  const interval = Number(process.env.STEAM_REQUEST_INTERVAL_MS ?? 1500);
  let ok = 0;
  for (const it of items) {
    try {
      await refreshOrderBook(it.marketHashName);
      ok++;
    } catch {
      /* skip */
    }
    await sleep(interval);
  }
  return ok;
}

/**
 * 説明文由来のステータス(基礎/固有/特殊/素材効果/スロット/必要Lv/素材分類)を更新する。
 * 説明文は静的なので worker から低頻度(日次)で呼ぶ。リスティングページを逐次取得するため
 * Steamレート制限を守って interval を空ける。1件失敗してもジョブ全体は止めない。
 *
 * onlyMissing=true の時はステータス行(statLines)を1件も持たないアイテムだけを対象にする。
 * 再デプロイで日次タイマーがリセットされクロールが走らない/レート制限で取りこぼした分を
 * 起動時に安価に埋めるための「穴埋め」モード。
 */
/**
 * 素材のレア度(grade)を wiki 由来データ(materials.json)で DB に同期する。
 * classify は「名前にレア度括弧の無い素材」を一律 COMMON にするため、素材の実グレードがズレる
 * (例: Kraken Ink は本来 BEYOND だが COMMON になる)。materials.json は wiki のグレードを持つので、
 * 名前一致で grade を上書きして正す。Steam 不要 (DB 更新のみ)。戻り値=更新件数。
 */
const VALID_GRADES = new Set(["COSMIC", "DIVINE", "CELESTIAL", "BEYOND", "ARCANA", "IMMORTAL", "LEGENDARY", "RARE", "UNCOMMON", "COMMON"]);
export async function syncMaterialGrades(): Promise<number> {
  let updated = 0;
  for (const m of getMaterials()) {
    if (!m.rarity || !VALID_GRADES.has(m.rarity)) continue;
    try {
      const res = await prisma.item.updateMany({
        where: { OR: [{ name: m.name }, { marketHashName: m.name }], grade: { not: m.rarity as never } },
        data: { grade: m.rarity as never },
      });
      updated += res.count;
    } catch (e) {
      captureException(e, { source: "jobs/syncMaterialGrades", level: "warning" });
    }
  }
  if (updated > 0) {
    try { await invalidate("items:*"); } catch { /* ignore */ }
  }
  return updated;
}

export async function refreshDescriptions(
  opts: { maxItems?: number; onlyMissing?: boolean; onProgress?: ProgressFn } = {},
): Promise<{ updated: number; total: number; skipped?: boolean }> {
  // 他のSteamジョブと直列化 (取得と説明文クロールの二重実行を防ぐ)。
  const r = await withLock(STEAM_JOB_LOCK, 60 * 60, () => refreshDescriptionsLocked(opts));
  if (!r.ran) return { updated: 0, total: 0, skipped: true };
  return r.value;
}

async function refreshDescriptionsLocked(
  opts: { maxItems?: number; onlyMissing?: boolean; onProgress?: ProgressFn },
): Promise<{ updated: number; total: number }> {
  const maxItems = opts.maxItems ?? 5000;
  await markStaleRunningLogs();
  const log = await prisma.fetchLog.create({ data: { kind: "descriptions", status: "RUNNING" } });
  const items = await prisma.item.findMany({
    where: { active: true, ...(opts.onlyMissing ? { statLines: { none: {} } } : {}) },
    select: { id: true, marketHashName: true },
    take: maxItems,
  });
  const interval = Number(process.env.STEAM_REQUEST_INTERVAL_MS ?? 3500);
  let updated = 0;
  let failed = 0;
  let done = 0;

  // フル取得時はクラスタグ(権威データ)で classType を確定 (穴埋めモードでは負荷回避でスキップ)。
  if (!opts.onlyMissing) {
    try {
      const updatedClasses = await refreshClassTags();
      console.log(`[jobs] class tags applied: ${updatedClasses}`);
    } catch (e) {
      captureException(e, { source: "jobs/refreshClassTags", level: "warning" });
    }
  }

  try {
    for (const it of items) {
      try {
        const parsed = await fetchItemDescription(it.marketHashName);
        if (parsed) {
          const fields = toItemDescriptionFields(parsed);
          const lines = toStatLines(parsed);
          // 説明文由来の正確なグレード/部位 (名前推定より正確。素材のレア度やメイン/サブ武器を正す)
          const grade = gradeFromDescription(parsed);
          const part = partFromItemType(parsed.itemType);
          // Item更新 + 既存statLines差し替えを1トランザクションで (途中状態を作らない)
          await prisma.$transaction([
            prisma.item.update({
              where: { id: it.id },
              data: {
                materialCategory: fields.materialCategory as any,
                requiredLevel: fields.requiredLevel,
                // 実レベル(Requires Lv.)を装備のレベルとして反映 (捏造値を上書きして正す)
                ...(fields.requiredLevel != null && { level: fields.requiredLevel }),
                ...(grade && { grade }),
                ...(part && { part }),
                decoSlots: fields.decoSlots,
                engraveSlots: fields.engraveSlots,
                inscriptSlots: fields.inscriptSlots,
              },
            }),
            prisma.itemStatLine.deleteMany({ where: { itemId: it.id } }),
            ...(lines.length
              ? [prisma.itemStatLine.createMany({ data: lines.map((l) => ({ ...l, itemId: it.id })) })]
              : []),
          ]);
          updated++;
        }
      } catch (e) {
        failed++;
        captureException(e, { source: "jobs/refreshDescriptions/item", level: "warning" });
      }
      done++;
      opts.onProgress?.({ phase: "descriptions", current: done, total: items.length });
      await sleep(interval);
    }

    await invalidate("items:");
    await prisma.fetchLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        itemsTotal: items.length,
        itemsOk: updated,
        itemsFailed: failed,
        message: `descriptions updated=${updated}/${items.length} failed=${failed}`,
        finishedAt: new Date(),
      },
    });
    return { updated, total: items.length };
  } catch (e) {
    captureException(e, { source: "jobs/refreshDescriptions", level: "error" });
    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "FAILED", message: (e as Error).message, finishedAt: new Date() },
    });
    throw e;
  }
}
