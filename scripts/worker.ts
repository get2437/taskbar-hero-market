/**
 * 自動更新ワーカー。docker compose の worker サービスとして常駐。
 * MARKET_REFRESH_CRON の先頭フィールド (分) から間隔を読み、定期的に runRefresh を実行する。
 * 例: "*" + "/15 * * * *" なら15分毎。
 * (軽量化のため完全な cron パーサは持たず、分間隔のみ解釈する)
 */
import { runRefresh, refreshHotOrderBooks, refreshDescriptions } from "../src/lib/jobs";
import { refreshRates } from "../src/lib/fx";
import { captureException, monitoringStatus } from "../src/lib/monitoring";

const HOT_INTERVAL_MS = Number(process.env.HOT_REFRESH_MS ?? 20_000); // 閲覧中銘柄の鮮度
const DESC_INTERVAL_MS = Number(process.env.DESC_REFRESH_MS ?? 24 * 3_600_000); // 説明文(ステータス)は静的→日次
const DESC_ON_START = process.env.DESC_REFRESH_ON_START === "true"; // 初回デプロイ用に起動後1回実行

function intervalMinutes(): number {
  const cron = process.env.MARKET_REFRESH_CRON ?? "*/15 * * * *";
  const m = cron.trim().split(/\s+/)[0];
  const match = m.match(/^\*\/(\d+)$/);
  if (match) return Math.max(1, parseInt(match[1], 10));
  return 15;
}

async function tick() {
  const started = new Date();
  console.log(`[worker] refresh start @ ${started.toISOString()}`);
  try {
    const r = await runRefresh({ fetch: true });
    console.log(`[worker] done: fetched=${r.fetched} analyzed=${r.analyzed} anomalies=${r.anomalies} notified=${r.notified} ${r.skippedFetch ? "(fetch skipped)" : ""}`);
  } catch (e) {
    captureException(e, { source: "worker/tick", level: "error" });
  }
}

async function hotTick() {
  try {
    const n = await refreshHotOrderBooks();
    if (n > 0) console.log(`[worker] hot order books refreshed: ${n}`);
  } catch (e) {
    console.error("[worker] hot refresh failed:", (e as Error).message);
  }
}

async function descTick() {
  console.log(`[worker] descriptions refresh start @ ${new Date().toISOString()}`);
  try {
    const r = await refreshDescriptions();
    console.log(`[worker] descriptions refreshed: ${r.updated}/${r.total}`);
  } catch (e) {
    captureException(e, { source: "worker/descTick", level: "error" });
  }
}

// 起動時の穴埋め: ステータス未取得のアイテムだけ説明文を取得する。
// 日次タイマーは再デプロイでリセットされ走らないことがあるため、未取得分を毎起動で確実に埋める。
async function descGapFill() {
  try {
    const r = await refreshDescriptions({ onlyMissing: true });
    if (r.total > 0) console.log(`[worker] descriptions gap-fill: ${r.updated}/${r.total}`);
  } catch (e) {
    captureException(e, { source: "worker/descGapFill", level: "warning" });
  }
}

async function main() {
  const minutes = intervalMinutes();
  console.log(
    `[worker] started. full refresh = ${minutes} min / hot refresh = ${HOT_INTERVAL_MS / 1000}s / descriptions = ${Math.round(DESC_INTERVAL_MS / 3_600_000)}h / monitoring = ${monitoringStatus()}`,
  );
  await tick();
  refreshRates().catch((e) => captureException(e, { source: "worker/fx", level: "warning" })); // 起動時に為替取得
  setInterval(tick, minutes * 60_000);
  setInterval(hotTick, HOT_INTERVAL_MS); // 閲覧中銘柄を高頻度で最新化
  setInterval(descTick, DESC_INTERVAL_MS); // 説明文(ステータス)を日次で最新化
  setInterval(() => refreshRates().catch((e) => captureException(e, { source: "worker/fx", level: "warning" })), 12 * 3_600_000); // 為替を12時間毎
  // 初回デプロイ時は seed 後の取りこぼし対策に起動後1回フル取得 (Steam負荷を避け60秒遅延)
  if (DESC_ON_START) setTimeout(descTick, 60_000);
  // フル取得しない場合でも、ステータス未取得アイテムは毎起動で穴埋めする (90秒遅延で重複起動を回避)
  else setTimeout(descGapFill, 90_000);
}

main();
