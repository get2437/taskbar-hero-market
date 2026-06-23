import { getAnomalies } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnomalyList } from "@/components/anomaly-list";
import { StatCard } from "@/components/stat-card";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AnomaliesPage() {
  const { t } = await getTranslator();
  const [anomalies, counts] = await Promise.all([
    getAnomalies(100),
    prisma.anomaly.groupBy({ by: ["type"], where: { resolved: false }, _count: true }),
  ]);
  const countOf = (type: string) => counts.find((c) => c.type === type)?._count ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("anom.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("anom.sub")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("anom.spikeUp")} value={countOf("SPIKE_UP")} accent="up" />
        <StatCard label={t("anom.spikeDown")} value={countOf("SPIKE_DOWN")} accent="down" />
        <StatCard label={t("anom.volSpike")} value={countOf("VOLUME_SPIKE")} accent="warning" />
        <StatCard label={t("anom.volDrop")} value={countOf("VOLUME_DROP")} />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("anom.detections")}</CardTitle></CardHeader>
        <CardContent><AnomalyList anomalies={anomalies} /></CardContent>
      </Card>
    </div>
  );
}
