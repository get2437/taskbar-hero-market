"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Database, Trash2, Activity, CheckCircle2, XCircle, Loader2, Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { formatNumber, formatDateTime } from "@/lib/utils";

interface RefreshInfo {
  running: boolean;
  kind: "refresh" | "reanalyze" | "descriptions" | "names" | null;
  startedAt: number | null;
  finishedAt: number | null;
  progress: { phase: string; current: number; total: number } | null;
  result: { fetched?: number; analyzed?: number; anomalies?: number; notified?: number; skippedFetch?: boolean; updated?: number; total?: number; skipped?: boolean } | null;
  error: string | null;
}

const PHASE_LABEL: Record<string, string> = {
  fetch: "Steam取得中",
  store: "保存中",
  analyze: "分析中",
  descriptions: "ステータス取得中",
  names: "アイテム名翻訳中",
  stats: "特殊ステータス翻訳中",
};

/** ジョブのメッセージ/エラーから「原因」と「対処」を推測して分かりやすく補足する。 */
function explainMessage(raw: string | null | undefined): { cause: string; action: string } | null {
  if (!raw) return null;
  const m = raw.toLowerCase();
  if (/\b429\b|rate limit|too many/.test(m))
    return { cause: "Steamのレート制限(429)で取得を拒否されました。", action: "数分待ってから再実行してください。短時間に連続実行しないでください。" };
  if (/timeout|timed out|etimedout|aborterror|aborted/.test(m))
    return { cause: "Steamへの接続がタイムアウトしました。", action: "ネットワークまたはSteam混雑の可能性。少し待って再実行してください。" };
  if (/\b5\d\d\b|server error|bad gateway|service unavailable/.test(m))
    return { cause: "Steam側のサーバーエラーです。", action: "Steam側の一時的な不調です。時間をおいて再実行してください。" };
  if (/econn|fetch failed|network|enotfound|getaddrinfo/.test(m))
    return { cause: "ネットワークエラーで取得できませんでした。", action: "サーバーのネット接続を確認して再実行してください。" };
  if (/検索結果が空|empty|no results/.test(m))
    return { cause: "Steam検索結果が空でした。", action: "STEAM_APP_ID と、対象にマーケットが存在するか確認してください。" };
  if (/anthropic|api key|translat/.test(m))
    return { cause: "翻訳API(任意)の未設定または失敗です。", action: "ニュース翻訳が必要なら ANTHROPIC_API_KEY を設定してください。未設定でも他機能は動作します。" };
  if (/unauthorized|401|admin_token/.test(m))
    return { cause: "管理者トークンが不正です。", action: "ADMIN_TOKEN を正しく入力してください。" };
  if (/中断|再起動|タイムアウトで完了/.test(raw))
    return { cause: "前回のジョブが完了を記録できませんでした。", action: "再起動やタイムアウトが原因です。もう一度実行すれば解消します。" };
  return null;
}

interface Status {
  counts: { itemCount: number; snapshotCount: number; historyCount: number; anomalyCount: number };
  lastUpdated: string | null;
  refresh?: RefreshInfo;
  logs: any[];
}

export function AdminPanel() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const prevRunning = useRef(false);

  const loadStatus = useCallback((tok?: string) => {
    const t = tok ?? (typeof window !== "undefined" ? localStorage.getItem("adminToken") ?? "" : "");
    fetch("/api/admin/status", { headers: { "x-admin-token": t } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
    if (saved) setToken(saved);
    loadStatus(saved ?? "");
  }, [loadStatus]);

  // 取得/分析の進行中はサーバ状態をポーリングし、完了したら結果を表示する。
  const running = status?.refresh?.running ?? false;
  const runningKind = status?.refresh?.kind ?? null;
  useEffect(() => {
    const r = status?.refresh;
    if (r?.running) {
      prevRunning.current = true;
      const id = setTimeout(() => loadStatus(), 4000);
      return () => clearTimeout(id);
    }
    if (prevRunning.current && r) {
      prevRunning.current = false;
      if (r.error) {
        const ex = explainMessage(r.error);
        setMsg({ ok: false, text: ex ? `失敗: ${ex.cause} ${ex.action}` : `失敗: ${r.error}` });
      } else if (r.result) {
        const d = r.result;
        if (d.skipped) {
          setMsg({ ok: false, text: "別のジョブ(定期更新など)が実行中のためスキップしました。少し待って再実行してください。" });
        } else if (r.kind === "descriptions") {
          setMsg({ ok: true, text: `ステータス取得 完了: ${d.updated ?? 0}/${d.total ?? 0} 件更新` });
        } else if (r.kind === "names") {
          setMsg({ ok: true, text: d.total === 0 ? "翻訳対象がありません（または翻訳APIキー未設定）" : `翻訳 完了: 名前・特殊ステータス ${d.updated ?? 0} 件` });
        } else {
          setMsg({
            ok: true,
            text: `完了: 取得${d.fetched ?? 0} / 分析${d.analyzed ?? 0} / 異常${d.anomalies ?? 0} / 通知${d.notified ?? 0}${d.skippedFetch ? " (取得スキップ)" : ""}`,
          });
        }
      }
    }
  }, [status, loadStatus]);

  function persistToken(v: string) {
    setToken(v);
    if (typeof window !== "undefined") localStorage.setItem("adminToken", v);
  }

  async function action(kind: "refresh" | "reanalyze" | "cache" | "history" | "descriptions" | "names") {
    setMsg(null);
    if (kind === "descriptions" || kind === "names") {
      const url = kind === "names" ? "/api/admin/translate-names" : "/api/admin/refresh-descriptions";
      const startMsg = kind === "names" ? "翻訳を開始しました（アイテム名・特殊ステータスの未翻訳分）" : "ステータス取得を開始しました（全件で数十分かかります）";
      try {
        const res = await fetch(url, { method: "POST", headers: { "x-admin-token": token } });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setMsg({ ok: false, text: data?.error ?? "失敗しました" });
          return;
        }
        if (data?.started === false && data?.running) setMsg({ ok: true, text: "既に処理が進行中です" });
        else setMsg({ ok: true, text: startMsg });
        loadStatus();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      }
      return;
    }
    if (kind === "history") {
      if (typeof window !== "undefined" && !window.confirm("シード由来の偽データを掃除します。価格履歴/スナップショットを全削除し(現在価格は維持)、騰落率と偽の異常をクリア、お気に入り数を実件数で再計算します。以後は実データだけで積み上がります。よろしいですか?")) return;
      setBusy("history");
      try {
        const res = await fetch("/api/admin/reset-history", { method: "POST", headers: { "x-admin-token": token } });
        const data = await res.json().catch(() => null);
        if (!res.ok) setMsg({ ok: false, text: data?.error ?? "失敗しました" });
        else setMsg({ ok: true, text: `掃除しました (履歴${data.removedHistory} / スナップショット${data.removedSnapshots} / 異常${data.clearedAnomalies} / お気に入り再計算${data.favoritesRecomputed})` });
        loadStatus();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      } finally {
        setBusy(null);
      }
      return;
    }
    if (kind === "cache") {
      setBusy("cache");
      try {
        const res = await fetch("/api/admin/cache", { method: "DELETE", headers: { "x-admin-token": token } });
        const data = await res.json().catch(() => null);
        if (!res.ok) setMsg({ ok: false, text: data?.error ?? "失敗しました" });
        else setMsg({ ok: true, text: `キャッシュを削除しました (${data.removed} keys)` });
        loadStatus();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      } finally {
        setBusy(null);
      }
      return;
    }
    // 取得/分析はバックグラウンド起動 → 即時応答。完了はポーリングで検知する。
    try {
      const fetchParam = kind === "reanalyze" ? "?fetch=false" : "";
      const res = await fetch(`/api/admin/refresh${fetchParam}`, { method: "POST", headers: { "x-admin-token": token } });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ ok: false, text: data?.error ?? "失敗しました" });
        return;
      }
      if (data?.started === false && data?.running) setMsg({ ok: true, text: "既に更新が進行中です" });
      else setMsg({ ok: true, text: kind === "refresh" ? "更新を開始しました（完了まで数分かかります）" : "再分析を開始しました" });
      loadStatus();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      {/* ステータス */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="アイテム数" value={formatNumber(status?.counts.itemCount)} />
        <StatCard label="スナップショット" value={formatNumber(status?.counts.snapshotCount)} />
        <StatCard label="価格履歴" value={formatNumber(status?.counts.historyCount)} />
        <StatCard label="未解決の異常" value={formatNumber(status?.counts.anomalyCount)} accent="warning" />
      </div>
      <p className="text-sm text-muted-foreground">最終更新: {status?.lastUpdated ? formatDateTime(status.lastUpdated) : "—"}</p>

      {/* 操作 */}
      <Card>
        <CardHeader><CardTitle>操作</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">管理者トークン (ADMIN_TOKEN)</label>
            <Input type="password" value={token} onChange={(e) => persistToken(e.target.value)} placeholder="ADMIN_TOKEN を入力" className="max-w-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => action("refresh")} disabled={running || busy != null}>
              {running && runningKind === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              データ更新 (取得+分析)
            </Button>
            <Button variant="secondary" onClick={() => action("reanalyze")} disabled={running || busy != null}>
              {running && runningKind === "reanalyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              再分析のみ
            </Button>
            <Button variant="secondary" onClick={() => action("descriptions")} disabled={running || busy != null}>
              {running && runningKind === "descriptions" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              ステータス取得 (特殊ステータス/Lv)
            </Button>
            <Button variant="secondary" onClick={() => action("names")} disabled={running || busy != null}>
              {running && runningKind === "names" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              翻訳 (名前・特殊ステータス)
            </Button>
            <Button variant="outline" onClick={() => action("cache")} disabled={running || busy != null}>
              {busy === "cache" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              キャッシュ削除
            </Button>
            <Button variant="outline" onClick={() => action("history")} disabled={running || busy != null} className="border-destructive/40 text-destructive hover:bg-destructive/10">
              {busy === "history" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              偽データ掃除
            </Button>
            <Button variant="ghost" onClick={() => loadStatus()} disabled={busy != null}>
              <Database className="h-4 w-4" /> 状況更新
            </Button>
          </div>
          {running && (() => {
            const pr = status?.refresh?.progress;
            const pct = pr && pr.total > 0 ? Math.min(100, Math.round((pr.current / pr.total) * 100)) : null;
            const phase = pr ? PHASE_LABEL[pr.phase] ?? pr.phase : null;
            return (
              <div className="space-y-1.5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase
                    ? `${phase}…`
                    : runningKind === "refresh"
                      ? "取得+分析を実行中…"
                      : runningKind === "descriptions"
                        ? "ステータス取得を実行中…"
                        : runningKind === "names"
                          ? "アイテム名翻訳を実行中…"
                          : "再分析を実行中…"}
                  {pr && pr.total > 0 && <span className="tabular font-medium text-foreground">{pr.current}/{pr.total}{pct != null ? ` (${pct}%)` : ""}</span>}
                  <span className="text-xs text-muted-foreground/70">画面を離れても継続します</span>
                </p>
                <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className={pct == null ? "h-full w-1/3 animate-pulse rounded-full bg-primary/60" : "h-full rounded-full bg-primary transition-all"}
                    style={pct == null ? undefined : { width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}
          {msg && (
            <div className={`flex items-center gap-2 rounded-md border p-2 text-sm ${msg.ok ? "border-up/40 text-up" : "border-destructive/40 text-destructive"}`}>
              {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {msg.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ジョブログ */}
      <Card>
        <CardHeader><CardTitle>ジョブログ</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">種別</th>
                  <th className="px-3 py-2 text-left">状態</th>
                  <th className="px-3 py-2 text-right">対象</th>
                  <th className="px-3 py-2 text-left">メッセージ</th>
                  <th className="px-3 py-2 text-left">開始</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // 進行中ジョブのログ行(=最新の RUNNING 行)に live 進捗を出すための id を特定。
                  const liveKind = runningKind === "descriptions" ? "descriptions" : "manual";
                  const liveLogId = running ? status?.logs.find((l) => l.status === "RUNNING" && l.kind === liveKind)?.id : null;
                  const pr = status?.refresh?.progress;
                  const pct = pr && pr.total > 0 ? Math.min(100, Math.round((pr.current / pr.total) * 100)) : null;
                  return status?.logs.map((l) => {
                    const ex = explainMessage(l.message);
                    const isLive = l.id === liveLogId;
                    return (
                      <tr key={l.id} className="border-b last:border-0 align-top">
                        <td className="px-3 py-1.5">{l.kind}</td>
                        <td className="px-3 py-1.5">
                          <span className={l.status === "SUCCESS" ? "text-up" : l.status === "FAILED" ? "text-destructive" : "text-muted-foreground"}>{l.status}</span>
                          {isLive && (
                            <span className="ml-1 inline-flex items-center gap-1 text-xs text-primary">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {pr && pr.total > 0 ? `${pr.current}/${pr.total}${pct != null ? ` (${pct}%)` : ""}` : (pr ? (PHASE_LABEL[pr.phase] ?? pr.phase) : "")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular">{l.itemsTotal}</td>
                        <td className="px-3 py-1.5 max-w-md text-muted-foreground">
                          <div className="truncate" title={l.message ?? ""}>{l.message ?? "—"}</div>
                          {ex && (
                            <div className="mt-0.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                              <span className="font-semibold">原因:</span> {ex.cause}{ex.action && <> <span className="font-semibold">対処:</span> {ex.action}</>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{formatDateTime(l.startedAt)}</td>
                      </tr>
                    );
                  });
                })()}
                {(!status || status.logs.length === 0) && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">ログがありません</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
