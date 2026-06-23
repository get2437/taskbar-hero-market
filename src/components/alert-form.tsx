"use client";
import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";

// [value, i18nキー, 入力種別]
const CONDITIONS = [
  ["PRICE_BELOW", "alert.condBelow", "price"],
  ["PRICE_ABOVE", "alert.condAbove", "price"],
  ["CHANGE_UP", "alert.condUp", "pct"],
  ["CHANGE_DOWN", "alert.condDown", "pct"],
  ["SPIKE_UP", "alert.condSpikeUp", "none"],
  ["SPIKE_DOWN", "alert.condSpikeDown", "none"],
  ["VOLUME_SPIKE", "alert.condVol", "none"],
] as const;

export function AlertForm({ itemId, currentPrice }: { itemId: string; currentPrice: number | null }) {
  const { t } = useT();
  const { fmt } = useMoney();
  const [condition, setCondition] = useState<string>("PRICE_BELOW");
  const [threshold, setThreshold] = useState("");
  const [channel, setChannel] = useState("WEB");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const meta = CONDITIONS.find((c) => c[0] === condition)!;
  const needsThreshold = meta[2] !== "none";

  async function submit() {
    setBusy(true);
    setDone(false);
    try {
      // 価格はそのまま最小通貨単位、％はbpsへ変換
      let thr: number | undefined;
      if (needsThreshold && threshold) {
        thr = meta[2] === "pct" ? Math.round(Number(threshold) * 100) : Number(threshold);
      }
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, condition, threshold: thr, channel }),
      });
      if (res.ok) {
        setDone(true);
        setThreshold("");
        setTimeout(() => setDone(false), 2500);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t("alert.condition")}</label>
        <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
          {CONDITIONS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
        </Select>
      </div>

      {needsThreshold && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            {t("alert.threshold")}
            {meta[2] === "pct" ? " (%)" : currentPrice != null ? ` (${fmt(currentPrice)})` : ""}
          </label>
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={meta[2] === "pct" ? "20" : "100"}
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t("alert.channel")}</label>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="WEB">{t("alert.web")}</option>
          <option value="DISCORD">{t("alert.discord")}</option>
          <option value="EMAIL">{t("alert.email")}</option>
        </Select>
      </div>

      <Button onClick={submit} disabled={busy || (needsThreshold && !threshold)} className="w-full">
        {done ? <><Check className="h-4 w-4" /> {t("alert.done")}</> : <><Bell className="h-4 w-4" /> {t("alert.set")}</>}
      </Button>
    </div>
  );
}
