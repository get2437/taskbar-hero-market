/**
 * リアルタイム配信基盤 (server only)。
 * publishLive で発火したイベントを、SSE接続中の全クライアントへ届ける。
 * プロセス跨ぎ (worker → app) は Redis pub/sub、単一プロセスはローカルEventEmitterでファンアウト。
 */
import Redis from "ioredis";
import { EventEmitter } from "node:events";
import { redis } from "./redis";

const CHANNEL = "live";

const g = globalThis as unknown as { __liveBus?: EventEmitter; __liveSub?: Redis | null };

export interface LiveEvent {
  type: "market" | "orderbook" | "anomaly" | "hello";
  [k: string]: unknown;
}

/** SSEルートが購読するためのバス。初回呼び出しで Redis サブスクライバを起動。 */
function getBus(): EventEmitter {
  if (!g.__liveBus) {
    const bus = new EventEmitter();
    bus.setMaxListeners(0); // 多数のSSEクライアント
    g.__liveBus = bus;
    const url = process.env.REDIS_URL;
    if (url) {
      const sub = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
      sub.on("error", () => {});
      sub.subscribe(CHANNEL).catch(() => {});
      sub.on("message", (_ch, msg) => {
        try {
          bus.emit("ev", JSON.parse(msg));
        } catch {
          /* ignore */
        }
      });
      g.__liveSub = sub;
    } else {
      g.__liveSub = null;
    }
  }
  return g.__liveBus;
}

/** イベントを全クライアントへ配信。 */
export async function publishLive(ev: LiveEvent): Promise<void> {
  if (redis) {
    try {
      await redis.publish(CHANNEL, JSON.stringify(ev));
      return;
    } catch {
      /* fall through to local */
    }
  }
  // Redis 無し: 同一プロセスのローカルバスへ直接
  getBus().emit("ev", ev);
}

/** SSEルート用: イベント購読。戻り値で解除。 */
export function subscribeLive(cb: (ev: LiveEvent) => void): () => void {
  const bus = getBus();
  const handler = (ev: LiveEvent) => cb(ev);
  bus.on("ev", handler);
  return () => {
    bus.off("ev", handler);
  };
}
