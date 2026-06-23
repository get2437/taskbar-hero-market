/**
 * 価格アラート評価と通知送信 (Web通知 + Discord Webhook)。
 * メール(SMTP)はインターフェイスのみ用意し、設定があれば送る。
 */
import { prisma } from "@/lib/prisma";
import { formatPrice, formatBps } from "@/lib/utils";

/** 全有効アラートを評価し、条件成立分を通知。戻り値=通知件数。 */
export async function evaluateAlerts(): Promise<number> {
  const alerts = await prisma.priceAlert.findMany({
    where: { enabled: true },
    include: { item: { include: { latest: true, anomalies: { where: { resolved: false, detectedAt: { gte: new Date(Date.now() - 3_600_000) } } } } } },
  });

  let notified = 0;
  for (const alert of alerts) {
    const latest = alert.item.latest;
    if (!latest) continue;

    // 連続通知の抑制 (1時間以内に再通知しない)
    if (alert.lastTriggered && Date.now() - alert.lastTriggered.getTime() < 3_600_000) continue;

    const price = latest.lowestPrice;
    const changePrev = latest.changePrev;
    let hit = false;
    let reason = "";

    switch (alert.condition) {
      case "PRICE_BELOW":
        if (price != null && alert.threshold != null && price <= alert.threshold) {
          hit = true;
          reason = `価格が ${formatPrice(alert.threshold)} 以下 (現在 ${formatPrice(price)})`;
        }
        break;
      case "PRICE_ABOVE":
        if (price != null && alert.threshold != null && price >= alert.threshold) {
          hit = true;
          reason = `価格が ${formatPrice(alert.threshold)} 以上 (現在 ${formatPrice(price)})`;
        }
        break;
      case "CHANGE_UP":
        if (changePrev != null && alert.threshold != null && changePrev >= alert.threshold) {
          hit = true;
          reason = `前日比 ${formatBps(changePrev)} (しきい値 ${formatBps(alert.threshold)})`;
        }
        break;
      case "CHANGE_DOWN":
        if (changePrev != null && alert.threshold != null && changePrev <= -Math.abs(alert.threshold)) {
          hit = true;
          reason = `前日比 ${formatBps(changePrev)} (しきい値 -${formatBps(Math.abs(alert.threshold))})`;
        }
        break;
      case "SPIKE_UP":
        if (alert.item.anomalies.some((a) => a.type === "SPIKE_UP")) {
          hit = true;
          reason = "急騰を検知";
        }
        break;
      case "SPIKE_DOWN":
        if (alert.item.anomalies.some((a) => a.type === "SPIKE_DOWN")) {
          hit = true;
          reason = "急落を検知";
        }
        break;
      case "VOLUME_SPIKE":
        if (alert.item.anomalies.some((a) => a.type === "VOLUME_SPIKE")) {
          hit = true;
          reason = "出来高急増を検知";
        }
        break;
    }

    if (!hit) continue;

    const title = `🔔 ${alert.item.name}`;
    const body = reason;

    // Web通知 (DBに保存 → フロントがポーリング)
    await prisma.notification.create({
      data: { userId: alert.userId, alertId: alert.id, title, body, channel: alert.channel },
    });

    if (alert.channel === "DISCORD") await sendDiscord(title, body);
    if (alert.channel === "EMAIL") await sendEmail(title, body);

    await prisma.priceAlert.update({ where: { id: alert.id }, data: { lastTriggered: new Date() } });
    notified++;
  }

  return notified;
}

async function sendDiscord(title: string, body: string) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**${title}**\n${body}` }),
    });
  } catch {
    /* 通知失敗はジョブを止めない */
  }
}

async function sendEmail(_title: string, _body: string) {
  // SMTP 設定があれば nodemailer 等で送信する想定。本MVPでは未配線。
  if (!process.env.SMTP_HOST) return;
}
