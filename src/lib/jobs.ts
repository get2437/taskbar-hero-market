/**
 * ジョブ・オーケストレーション。
 * 手動更新 (管理画面) と worker (15分毎) の双方から呼ばれる。
 *   1. Steam取得 (失敗/未設定ならスキップ)
 *   2. 分析エンジン実行
 *   3. 価格アラート評価 → 通知 (Web/Discord)
 */
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { searchAllItems } from "@/lib/steam/fetch";
import { storeFetched } from "@/lib/steam/store";
import { runAnalysis } from "@/lib/analysis/engine";
import { evaluateAlerts } from "@/lib/alerts";
import { fetchNews } from "@/lib/steam/news";
import { translatePendingNews } from "@/lib/steam/news-translate";
import { publishLive } from "@/lib/live";
import { getHotItemIds } from "@/lib/hot";
import { refreshOrderBook } from "@/lib/steam/orderbook";
import { fetchItemDescription, toItemDescriptionFields, toStatLines, gradeFromDescription, partFromItemType } from "@/lib/steam/descriptions";
import { captureException } from "@/lib/monitoring";

export interface RefreshResult {
  fetched: number;
  analyzed: number;
  anomalies: number;
  notified: number;
  skippedFetch: boolean;
  message: string;
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

export async function runRefresh(opts: { fetch?: boolean; onProgress?: ProgressFn } = {}): Promise<RefreshResult> {
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
      // 新着記事を多言語へ自動翻訳 (ANTHROPIC_API_KEY 未設定なら no-op)
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
 * 閲覧中(ホット)アイテムの注文板を優先的に最新化し、SSEで配信する。
 * worker から高頻度(例:20秒毎)に呼ぶ。Steamレート制限を守るため件数/間隔を制限。
 */
export async function refreshHotOrderBooks(maxItems = 8): Promise<number> {
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
export async function refreshDescriptions(
  opts: { maxItems?: number; onlyMissing?: boolean; onProgress?: ProgressFn } = {},
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
