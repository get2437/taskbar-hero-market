/**
 * 監視 / エラー収集 (依存パッケージ無し・env未設定なら構造化ログのみ)。
 *
 * 送信先 (任意・両方同時可):
 *   - SENTRY_DSN            … 設定時 Sentry へイベント送信 (SDK不要・最小エンベロープ)
 *   - MONITORING_WEBHOOK_URL … 設定時 Discord/Slack/汎用 へ JSON POST
 *
 * いずれも未設定なら stderr に構造化ログを出すだけ (本番でも安全に no-op 動作)。
 * サーバ専用 (DSN/Webhook を秘匿)。クライアントからは /api/client-error 経由で届く。
 */

const SENTRY_DSN = process.env.SENTRY_DSN?.trim();
const WEBHOOK_URL = process.env.MONITORING_WEBHOOK_URL?.trim();
const ENV = process.env.NODE_ENV ?? "development";
const RELEASE = process.env.APP_RELEASE ?? process.env.npm_package_version ?? "dev";

export type Level = "fatal" | "error" | "warning" | "info";

export interface CaptureContext {
  /** 発生箇所 (例: "api/items", "worker", "client-boundary") */
  source?: string;
  /** 任意の付随情報 */
  extra?: Record<string, unknown>;
  level?: Level;
}

/** DSN を分解。形式: https://<key>@<host>/<projectId> */
function parseDsn(dsn: string): { key: string; host: string; projectId: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !u.host || !projectId) return null;
    return { key: u.username, host: u.host, projectId };
  } catch {
    return null;
  }
}

function randomHex(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

async function sendToSentry(err: Error, ctx: CaptureContext): Promise<void> {
  if (!SENTRY_DSN) return;
  const dsn = parseDsn(SENTRY_DSN);
  if (!dsn) return;

  const eventId = randomHex(32);
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "node",
    level: ctx.level ?? "error",
    release: RELEASE,
    environment: ENV,
    server_name: ctx.source ?? "server",
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: err.message || String(err),
          stacktrace: err.stack ? { frames: [{ filename: "app", function: err.stack.split("\n")[1]?.trim() ?? "" }] } : undefined,
        },
      ],
    },
    extra: ctx.extra,
  };

  const auth = `Sentry sentry_version=7, sentry_client=taskbar-hero/1.0, sentry_key=${dsn.key}`;
  const url = `https://${dsn.host}/api/${dsn.projectId}/store/`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentry-Auth": auth },
      body: JSON.stringify(event),
      signal: ctrl.signal,
    });
  } catch {
    /* 監視送信の失敗でアプリを壊さない */
  } finally {
    clearTimeout(t);
  }
}

async function sendToWebhook(err: Error, ctx: CaptureContext): Promise<void> {
  if (!WEBHOOK_URL) return;
  const title = `🚨 [${ENV}] ${ctx.source ?? "server"}: ${err.name}`;
  const body = `${err.message}\n\`\`\`\n${(err.stack ?? "").split("\n").slice(0, 6).join("\n")}\n\`\`\``;
  // Discord webhook 互換 (content)。Slack や汎用でも JSON として受理可能。
  const payload = {
    content: `${title}\n${body}`.slice(0, 1900),
    source: ctx.source,
    level: ctx.level ?? "error",
    error: { name: err.name, message: err.message },
    extra: ctx.extra,
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch {
    /* no-op */
  } finally {
    clearTimeout(t);
  }
}

/**
 * 例外を捕捉して記録/送信する。await 不要 (fire-and-forget で呼べる)。
 * 失敗してもアプリ本体には影響しない。
 */
export function captureException(error: unknown, ctx: CaptureContext = {}): void {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));

  // 常に構造化ログ (これだけで Sentry/Webhook 無しでも収集できる)
  console.error(
    JSON.stringify({
      lvl: ctx.level ?? "error",
      src: ctx.source ?? "server",
      msg: err.message,
      name: err.name,
      stack: err.stack?.split("\n").slice(0, 4).join(" | "),
      extra: ctx.extra,
      ts: new Date().toISOString(),
    })
  );

  // 送信は非同期・ベストエフォート
  void Promise.allSettled([sendToSentry(err, ctx), sendToWebhook(err, ctx)]);
}

/** 監視の有効状態 (起動ログ用) */
export function monitoringStatus(): string {
  const sinks = [SENTRY_DSN ? "sentry" : null, WEBHOOK_URL ? "webhook" : null].filter(Boolean);
  return sinks.length ? `enabled(${sinks.join("+")})` : "log-only";
}
