"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Folder, Plus, Trash2, Save, Bell, BellOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from "@/components/ui/misc";
import { StatCard } from "@/components/stat-card";
import { ItemThumb, GradeBadge, PriceChange, ScoreBadge } from "@/components/domain";
import { ItemName } from "@/components/item-name";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";
import { formatBps, formatNumber, cn } from "@/lib/utils";

interface FavView {
  favoriteId: string; id: string; name: string; nameI18n?: Record<string, string> | null; imageUrl: string | null; grade: string; type: string; level: number | null;
  lowestPrice: number | null; change7d: number | null; changePrev: number | null; investmentScore: number | null; riskLevel: string | null;
  folderId: string | null; memo: string | null; purchasePrice: number | null;
  profit: number | null; profitAfterFee: number | null; profitRate: number | null;
}
interface FolderT { id: string; name: string; color: string | null; count: number }

export function FavoritesView() {
  const { t } = useT();
  const { fmt } = useMoney();
  const [favorites, setFavorites] = useState<FavView[]>([]);
  const [folders, setFolders] = useState<FolderT[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [sort, setSort] = useState("created");
  const [loading, setLoading] = useState(true);
  const [newFolder, setNewFolder] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const fp = new URLSearchParams();
    if (activeFolder) fp.set("folderId", activeFolder);
    fp.set("sort", sort);
    Promise.all([
      fetch(`/api/favorites?${fp}`).then((r) => r.json()),
      fetch("/api/folders").then((r) => r.json()),
    ])
      .then(([f, fo]) => {
        setFavorites(f.favorites ?? []);
        setFolders(fo.folders ?? []);
      })
      .finally(() => setLoading(false));
  }, [activeFolder, sort]);

  useEffect(() => { load(); }, [load]);

  async function createFolder() {
    if (!newFolder.trim()) return;
    await fetch("/api/folders", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newFolder.trim() }),
    });
    setNewFolder("");
    load();
  }

  async function removeFavorite(favoriteId: string) {
    await fetch(`/api/favorites/${favoriteId}`, { method: "DELETE" });
    setFavorites((f) => f.filter((x) => x.favoriteId !== favoriteId));
  }

  const totalProfit = favorites.reduce((a, f) => a + (f.profitAfterFee ?? 0), 0);
  const hasPurchase = favorites.some((f) => f.purchasePrice != null);

  return (
    <Tabs defaultValue="list" className="space-y-4">
      <TabsList>
        <TabsTrigger value="list">{t("fav.tabList")}</TabsTrigger>
        <TabsTrigger value="alerts">{t("fav.tabAlerts")}</TabsTrigger>
        <TabsTrigger value="notifications">{t("fav.tabHistory")}</TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="space-y-4">
        {/* サマリ */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t("fav.count")} value={formatNumber(favorites.length)} />
          <StatCard label={t("fav.upToday")} value={formatNumber(favorites.filter((f) => (f.changePrev ?? 0) > 0).length)} accent="up" />
          <StatCard label={t("fav.downToday")} value={formatNumber(favorites.filter((f) => (f.changePrev ?? 0) < 0).length)} accent="down" />
          <StatCard label={t("dash.pl")} value={hasPurchase ? fmt(totalProfit) : "—"} accent={totalProfit >= 0 ? "up" : "down"} />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          {/* フォルダ */}
          <aside className="lg:w-56 lg:shrink-0">
            <Card>
              <CardContent className="space-y-1 p-3">
                <FolderRow active={activeFolder === null} onClick={() => setActiveFolder(null)} label={t("fav.all")} color="#64748b" />
                {folders.map((f) => (
                  <FolderRow key={f.id} active={activeFolder === f.id} onClick={() => setActiveFolder(f.id)} label={f.name} count={f.count} color={f.color ?? "#64748b"} />
                ))}
                <div className="flex items-center gap-1 pt-2">
                  <Input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder={t("fav.newFolder")} className="h-8" onKeyDown={(e) => e.key === "Enter" && createFolder()} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={createFolder}><Plus className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* リスト */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center justify-end">
              <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto">
                <option value="created">{t("fav.sortCreated")}</option>
                <option value="price">{t("fav.sortPrice")}</option>
                <option value="change">{t("fav.sortChange")}</option>
                <option value="score">{t("fav.sortScore")}</option>
              </Select>
            </div>

            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : favorites.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("fav.empty")}</div>
            ) : (
              <div className="space-y-2">
                {favorites.map((f) => (
                  <FavoriteCard key={f.favoriteId} fav={f} folders={folders} onRemove={() => removeFavorite(f.favoriteId)} onSaved={load} />
                ))}
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="alerts"><AlertsTab /></TabsContent>
      <TabsContent value="notifications"><NotificationsTab /></TabsContent>
    </Tabs>
  );
}

function FolderRow({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count?: number; color: string }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors", active ? "bg-primary/10 text-primary" : "hover:bg-accent")}>
      <Folder className="h-4 w-4 shrink-0" style={{ color }} />
      <span className="flex-1 truncate text-left">{label}</span>
      {count != null && <span className="text-xs text-muted-foreground">{count}</span>}
    </button>
  );
}

function FavoriteCard({ fav, folders, onRemove, onSaved }: { fav: FavView; folders: FolderT[]; onRemove: () => void; onSaved: () => void }) {
  const { t, f: ft } = useT();
  const { fmt } = useMoney();
  const [memo, setMemo] = useState(fav.memo ?? "");
  const [purchase, setPurchase] = useState(fav.purchasePrice?.toString() ?? "");
  const [folderId, setFolderId] = useState(fav.folderId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/favorites/${fav.favoriteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memo: memo || null,
        purchasePrice: purchase ? Number(purchase) : null,
        folderId: folderId || null,
      }),
    });
    setSaving(false);
    onSaved();
  }

  const profitAfterFee = purchase && fav.lowestPrice != null ? Math.round(fav.lowestPrice * 0.85) - Number(purchase) : null;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-wrap items-start gap-3">
          <Link href={`/items/${fav.id}`} className="flex min-w-0 flex-1 items-center gap-2">
            <ItemThumb src={fav.imageUrl} alt={fav.name} size={40} />
            <div className="min-w-0">
              <ItemName name={fav.name} nameI18n={fav.nameI18n} className="truncate font-medium hover:underline" inline />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GradeBadge grade={fav.grade} /><span>{ft(fav.type)}</span>{fav.level != null && <span>Lv{fav.level}</span>}
              </div>
            </div>
          </Link>
          <div className="text-right">
            <div className="font-bold tabular">{fmt(fav.lowestPrice)}</div>
            <div className="flex items-center gap-2 text-xs">
              <PriceChange bps={fav.change7d} /><ScoreBadge score={fav.investmentScore} risk={fav.riskLevel} />
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
        </div>

        {/* メモ・損益 */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <label className="text-xs text-muted-foreground">{t("fav.memo")}</label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("fav.memoPh")} className="h-8" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("fav.purchase")}</label>
            <Input type="number" value={purchase} onChange={(e) => setPurchase(e.target.value)} placeholder="—" className="h-8 w-28" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("fav.folder")}</label>
            <Select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="h-8 w-32">
              <option value="">{t("fav.uncategorized")}</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {t("fav.save")}</Button>
        </div>

        {profitAfterFee != null && (
          <div className="mt-2 flex items-center gap-3 rounded bg-muted/40 px-3 py-1.5 text-xs tabular">
            <span className="text-muted-foreground">{t("fav.plSim")}:</span>
            <span>{t("fav.bought")} {fmt(Number(purchase))}</span>
            <span>→ {t("fav.now")} {fmt(fav.lowestPrice)}</span>
            <span className={cn("font-bold", profitAfterFee >= 0 ? "text-up" : "text-down")}>
              {t("fav.afterFee")} {profitAfterFee >= 0 ? "+" : ""}{fmt(profitAfterFee)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsTab() {
  const { t } = useT();
  const { fmt } = useMoney();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.alerts ?? [])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    load();
  }
  async function remove(id: string) { await fetch(`/api/alerts/${id}`, { method: "DELETE" }); load(); }

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (alerts.length === 0) return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("fav.alertsEmpty")}</div>;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex items-center gap-3 p-3">
            <ItemThumb src={a.item.imageUrl} alt={a.item.name} size={36} />
            <div className="min-w-0 flex-1">
              <Link href={`/items/${a.item.id}`} className="truncate font-medium hover:underline">{a.item.name}</Link>
              <div className="text-xs text-muted-foreground">
                {t(`cond.${a.condition}`)} {a.threshold != null && (a.condition.startsWith("PRICE") ? fmt(a.threshold) : formatBps(a.threshold))} · {a.channel}
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggle(a.id, !a.enabled)} title={a.enabled ? t("fav.disable") : t("fav.enable")}>
              {a.enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NotificationsTab() {
  const { t } = useT();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/notifications").then((r) => r.json()).then((d) => setItems(d.notifications ?? [])).finally(() => setLoading(false));
    fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  }, []);
  if (loading) return <Skeleton className="h-32 w-full" />;
  if (items.length === 0) return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("fav.notifEmpty")}</div>;
  return (
    <div className="space-y-2">
      {items.map((n) => (
        <Card key={n.id}><CardContent className="p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{n.title}</span>
            <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
          </div>
          <div className="text-sm text-muted-foreground">{n.body}</div>
        </CardContent></Card>
      ))}
    </div>
  );
}
