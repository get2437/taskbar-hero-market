"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Database, Trash2, Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { formatNumber, formatDateTime } from "@/lib/utils";

interface RefreshInfo {
  running: boolean;
  kind: "refresh" | "reanalyze" | null;
  startedAt: number | null;
  finishedAt: number | null;
  result: { fetched?: number; analyzed?: number; anomalies?: number; notified?: number; skippedFetch?: boolean } | null;
  error: string | null;
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
      const id = setTimeout(() => loadStatus(), 6000);
      return () => clearTimeout(id);
    }
    if (prevRunning.current && r) {
      prevRunning.current = false;
      if (r.error) setMsg({ ok: false, text: `失敗: ${r.error}` });
      else if (r.result) {
        const d = r.result;
        setMsg({
          ok: true,
          text: `完了: 取得${d.fetched ?? 0} / 分析${d.analyzed ?? 0} / 異常${d.anomalies ?? 0} / 通知${d.notified ?? 0}${d.skippedFetch ? " (取得スキップ)" : ""}`,
        });
      }
    }
  }, [status, loadStatus]);

  function persistToken(v: string) {
    setToken(v);
    if (typeof window !== "undefined") localStorage.setItem("adminToken", v);
  }

  async function action(kind: "refresh" | "reanalyze" | "cache") {
    setMsg(null);
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
            <Button variant="outline" onClick={() => action("cache")} disabled={running || busy != null}>
              {busy === "cache" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              キャッシュ削除
            </Button>
            <Button variant="ghost" onClick={() => loadStatus()} disabled={busy != null}>
              <Database className="h-4 w-4" /> 状況更新
            </Button>
          </div>
          {running && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {runningKind === "refresh" ? "取得+分析を実行中…（数分かかります。画面を離れても継続します）" : "再分析を実行中…"}
            </p>
          )}
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
                {status?.logs.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{l.kind}</td>
                    <td className="px-3 py-1.5">
                      <span className={l.status === "SUCCESS" ? "text-up" : l.status === "FAILED" ? "text-destructive" : "text-muted-foreground"}>{l.status}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular">{l.itemsTotal}</td>
                    <td className="px-3 py-1.5 max-w-md truncate text-muted-foreground" title={l.message ?? ""}>{l.message ?? "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{formatDateTime(l.startedAt)}</td>
                  </tr>
                ))}
                {(!status || status.logs.length === 0) && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">ログがありません</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
