/**
 * 手動データ更新の進行状態を保持する（プロセス内共有）。
 * 全件取得は 70 ページ超 × 取得間隔で数分かかり nginx のタイムアウトを超えるため、
 * API はジョブを即時バックグラウンド起動して状態だけ返し、UI はこの状態をポーリングする。
 * HMR / モジュール重複でも 1 つになるよう globalThis に保持する。
 */
export interface RefreshState {
  running: boolean;
  kind: "refresh" | "reanalyze" | "descriptions" | "names" | null;
  startedAt: number | null;
  finishedAt: number | null;
  // 進行中ジョブの進捗 (phase: 取得/説明文/分析 等)。current/total が分かるものだけ入れる。
  progress: { phase: string; current: number; total: number } | null;
  result: {
    fetched?: number;
    analyzed?: number;
    anomalies?: number;
    notified?: number;
    skippedFetch?: boolean;
    // 説明文クロール (ステータス/特殊ステータス取得) 用
    updated?: number;
    total?: number;
  } | null;
  error: string | null;
}

const g = globalThis as unknown as { __refreshState?: RefreshState };

export const refreshState: RefreshState =
  g.__refreshState ??
  (g.__refreshState = {
    running: false,
    kind: null,
    startedAt: null,
    finishedAt: null,
    progress: null,
    result: null,
    error: null,
  });
