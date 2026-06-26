/**
 * 自動更新ワーカー。docker compose の worker サービスとして常駐。
 * MARKET_REFRESH_CRON の先頭フィールド (分) から間隔を読み、定期的に runRefresh を実行する。
 * 例: "*" + "/15 * * * *" なら15分毎。
 * (軽量化のため完全な cron パーサは持たず、分間隔のみ解釈する)
 */
import { runRefresh, refreshHotOrderBooks, refreshDescriptions, refreshClassTags } from "../src/lib/jobs";
import { translateItemNames, translateStatLines } from "../src/lib/steam/name-translate";
import { refreshRates } from "../src/lib/fx";
import { withLock, STEAM_JOB_LOCK } from "../src/lib/lock";
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
    if (r.skipped) console.log("[worker] refresh skipped (another job is running / lock held)");
    else console.log(`[worker] done: fetched=${r.fetched} analyzed=${r.analyzed} anomalies=${r.anomalies} notified=${r.notified} ${r.skippedFetch ? "(fetch skipped)" : ""}`);
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

// 起動時にクラスタグ(権威データ)を同期する。武器/サブ武器のクラスを Steam の class タグで確定。
// 日次の説明文クロールだけだと再デプロイ時に走らないことがあるため、起動毎に1回適用する。
async function classTagGapFill() {
  try {
    // Steam取得系と直列化 (取得ジョブと競合しない)
    const r = await withLock(STEAM_JOB_LOCK, 10 * 60, () => refreshClassTags());
    if (r.ran && r.value > 0) console.log(`[worker] class tags applied: ${r.value}`);
  } catch (e) {
    captureException(e, { source: "worker/classTagGapFill", level: "warning" });
  }
}

// 起動時の穴埋め: アイテム名が未翻訳のものだけ機械翻訳する (ANTHROPIC_API_KEY 未設定なら no-op)。
async function nameTranslateGapFill() {
  try {
    const r = await translateItemNames({ onlyMissing: true });
    if (r.updated > 0) console.log(`[worker] item-name translation gap-fill: ${r.updated}/${r.total}`);
    const s = await translateStatLines({ onlyMissing: true });
    if (s.updated > 0) console.log(`[worker] special-stat translation gap-fill: ${s.updated} rows / ${s.total} texts`);
  } catch (e) {
    captureException(e, { source: "worker/nameTranslateGapFill", level: "warning" });
  }
}

// 起動時の穴埋めを順番に実行する (各ジョブが Steamロックを順に取得するので競合しない)。
async function startupTasks() {
  if (DESC_ON_START) {
    await descTick(); // フル説明文クロール (内部でクラスタグも同期)
  } else {
    await classTagGapFill(); // クラスタグ(武器/サブ武器のクラス)を確実に同期
    await descGapFill(); // ステータス未取得アイテムの穴埋め
  }
  await nameTranslateGapFill(); // 名前/特殊ステータスの未翻訳分 (Steamロック不要)
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
  // 起動時の穴埋めは直列実行 (Steamロックで互いに競合しないよう順番に)。初回 tick 完了後に開始。
  setTimeout(startupTasks, 60_000);
}

main();
