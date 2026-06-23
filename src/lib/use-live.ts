"use client";
import { useEffect, useRef, useState } from "react";

export interface LiveState {
  connected: boolean;
}

/** SSE (/api/live) を購読し、各イベントを onEvent に渡す。接続状態も返す。 */
export function useLive(onEvent: (ev: any) => void): LiveState {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/live");
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        ref.current(JSON.parse(e.data));
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      setConnected(false);
      // EventSource はデフォルトで自動再接続する
    };
    return () => es.close();
  }, []);

  return { connected };
}
