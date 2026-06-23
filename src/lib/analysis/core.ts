/**
 * 分析エンジン (純粋関数のみ / DB非依存)。
 *
 * 価格は最小通貨単位の整数。変化率は basis points (bps, 100 = 1.00%) で扱う。
 * すべて副作用なしなので単体テスト・スクリプト・APIから再利用できる。
 */

export interface PricePoint {
  /** epoch millis */
  t: number;
  /** 約定価格 (最小通貨単位) */
  price: number;
  /** 出来高 */
  quantity: number;
}

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// 基本統計
// ---------------------------------------------------------------------------

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** 直近 windowDays 日の価格を出来高加重平均した移動平均。データ無しは null。 */
export function movingAverage(points: PricePoint[], windowDays: number, now = Date.now()): number | null {
  const from = now - windowDays * DAY;
  const win = points.filter((p) => p.t >= from);
  if (win.length === 0) return null;
  const totalQty = win.reduce((a, p) => a + Math.max(p.quantity, 1), 0);
  const weighted = win.reduce((a, p) => a + p.price * Math.max(p.quantity, 1), 0);
  return Math.round(weighted / totalQty);
}

/** ボラティリティ = 直近windowの価格標準偏差 / 平均 を bps で返す。 */
export function volatilityBps(points: PricePoint[], windowDays = 30, now = Date.now()): number | null {
  const from = now - windowDays * DAY;
  const prices = points.filter((p) => p.t >= from).map((p) => p.price);
  if (prices.length < 2) return null;
  const m = mean(prices);
  if (m === 0) return null;
  return Math.round((stddev(prices) / m) * 10_000);
}

// ---------------------------------------------------------------------------
// トレンド (最小二乗法の傾き)
// ---------------------------------------------------------------------------

export interface TrendResult {
  /** 1日あたりの価格変化を平均比 bps で表したもの */
  slopeBps: number;
  trend: "UP" | "DOWN" | "FLAT";
}

export function detectTrend(points: PricePoint[], windowDays = 30, now = Date.now()): TrendResult {
  const from = now - windowDays * DAY;
  const win = points.filter((p) => p.t >= from);
  if (win.length < 3) return { slopeBps: 0, trend: "FLAT" };

  // x = 日数(基準からの相対), y = 価格
  const x0 = win[0].t;
  const xs = win.map((p) => (p.t - x0) / DAY);
  const ys = win.map((p) => p.price);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den; // 価格/日
  const slopeBps = my === 0 ? 0 : Math.round((slope / my) * 10_000);

  // ±0.5%/日 を境にトレンド判定
  const trend = slopeBps > 50 ? "UP" : slopeBps < -50 ? "DOWN" : "FLAT";
  return { slopeBps, trend };
}

// ---------------------------------------------------------------------------
// 適正価格 / 割安・割高
// ---------------------------------------------------------------------------

export interface FairValue {
  fairPrice: number | null;
  /** +なら割安 (現在価格 < 適正), bps */
  undervaluedRate: number | null;
  /** +なら割高, bps */
  overvaluedRate: number | null;
}

/**
 * 適正価格 = 7/30/90日移動平均の加重平均 (短期を重視しつつ長期で安定化)。
 * 割安率 = (適正 - 現在) / 適正。
 */
export function estimateFairValue(
  currentPrice: number | null,
  ma7: number | null,
  ma30: number | null,
  ma90: number | null,
): FairValue {
  const parts: Array<[number, number]> = [];
  if (ma7 != null) parts.push([ma7, 0.5]);
  if (ma30 != null) parts.push([ma30, 0.3]);
  if (ma90 != null) parts.push([ma90, 0.2]);
  if (parts.length === 0 || currentPrice == null) {
    return { fairPrice: null, undervaluedRate: null, overvaluedRate: null };
  }
  const wsum = parts.reduce((a, [, w]) => a + w, 0);
  const fairPrice = Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / wsum);
  if (fairPrice === 0) return { fairPrice, undervaluedRate: null, overvaluedRate: null };
  const diffBps = Math.round(((fairPrice - currentPrice) / fairPrice) * 10_000);
  return {
    fairPrice,
    undervaluedRate: diffBps > 0 ? diffBps : 0,
    overvaluedRate: diffBps < 0 ? -diffBps : 0,
  };
}

// ---------------------------------------------------------------------------
// 投資スコア (100点満点)
//   価格推移25 / 出来高25 / 安定性20 / ボラティリティ15 / 市場人気度15
// ---------------------------------------------------------------------------

export interface ScoreInput {
  currentPrice: number | null;
  ma30: number | null;
  trend: TrendResult;
  volatilityBps: number | null;
  /** 直近の平均出来高 */
  avgQuantity: number;
  /** 全アイテム中の出来高パーセンタイル 0-1 (市場人気度) */
  volumePercentile: number;
  /** お気に入り登録数の正規化 0-1 */
  favoritePercentile: number;
}

export interface ScoreResult {
  total: number;
  price: number;
  volume: number;
  stability: number;
  volatility: number;
  popularity: number;
  riskLevel: "DANGER" | "CAUTION" | "GOOD" | "PROMISING";
  recommendation: "S" | "A" | "B" | "C";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function investmentScore(input: ScoreInput): ScoreResult {
  // 価格推移 (25): 割安かつ上昇トレンドを高評価
  let price = 12.5;
  if (input.currentPrice != null && input.ma30) {
    const undervalued = (input.ma30 - input.currentPrice) / input.ma30; // +で割安
    price = 12.5 + undervalued * 60; // ±20%で±12pt
  }
  price += clamp(input.trend.slopeBps / 100, -6, 6); // 上昇で加点
  price = clamp(price, 0, 25);

  // 出来高 (25): 取引が活発なほど高い (対数スケール)
  const volume = clamp(Math.log10(input.avgQuantity + 1) * 9, 0, 25);

  // 安定性 (20): トレンドの傾きが緩やか=安定
  const stability = clamp(20 - Math.abs(input.trend.slopeBps) / 30, 0, 20);

  // ボラティリティ (15): 低いほど高評価 (15% で半分)
  const vol = input.volatilityBps ?? 1500;
  const volatility = clamp(15 - (vol / 1500) * 7.5, 0, 15);

  // 市場人気度 (15): 出来高+お気に入りの複合
  const popularity = clamp(
    input.volumePercentile * 9 + input.favoritePercentile * 6,
    0,
    15,
  );

  const total = Math.round(price + volume + stability + volatility + popularity);

  const riskLevel =
    total >= 80 ? "PROMISING" : total >= 60 ? "GOOD" : total >= 40 ? "CAUTION" : "DANGER";
  const recommendation = total >= 80 ? "S" : total >= 65 ? "A" : total >= 45 ? "B" : "C";

  return {
    total: clamp(total, 0, 100),
    price: Math.round(price),
    volume: Math.round(volume),
    stability: Math.round(stability),
    volatility: Math.round(volatility),
    popularity: Math.round(popularity),
    riskLevel,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// 異常値検知
// ---------------------------------------------------------------------------

export type AnomalyKind = "SPIKE_UP" | "SPIKE_DOWN" | "VOLUME_SPIKE" | "VOLUME_DROP";
export type Win = "H1" | "H24" | "D7" | "D30" | "D90";

export interface DetectedAnomaly {
  type: AnomalyKind;
  window: Win;
  changeBps: number;
}

const PRICE_WINDOWS: Array<{ window: Win; ms: number; thresholdBps: number }> = [
  { window: "H1", ms: 3_600_000, thresholdBps: 1000 }, // ±10%
  { window: "H24", ms: DAY, thresholdBps: 2000 }, // ±20%
  { window: "D7", ms: 7 * DAY, thresholdBps: 4000 }, // ±40%
];

/** 価格スパイク検知: 各ウィンドウの起点価格と現在価格を比較。 */
export function detectPriceAnomalies(points: PricePoint[], now = Date.now()): DetectedAnomaly[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const current = sorted[sorted.length - 1].price;
  const out: DetectedAnomaly[] = [];

  for (const w of PRICE_WINDOWS) {
    const from = now - w.ms;
    const base = sorted.find((p) => p.t >= from);
    if (!base || base.price === 0) continue;
    const changeBps = Math.round(((current - base.price) / base.price) * 10_000);
    if (Math.abs(changeBps) >= w.thresholdBps) {
      out.push({ type: changeBps > 0 ? "SPIKE_UP" : "SPIKE_DOWN", window: w.window, changeBps });
    }
  }
  return out;
}

/** 出来高異常検知: 直近24hの出来高が過去30日平均の何倍か。 */
export function detectVolumeAnomalies(points: PricePoint[], now = Date.now()): DetectedAnomaly[] {
  const recent = points.filter((p) => p.t >= now - DAY).reduce((a, p) => a + p.quantity, 0);
  const past = points.filter((p) => p.t >= now - 30 * DAY && p.t < now - DAY);
  if (past.length === 0) return [];
  const dailyAvg = past.reduce((a, p) => a + p.quantity, 0) / 30;
  if (dailyAvg <= 0) return [];
  const ratio = recent / dailyAvg;
  const ratioBps = Math.round(ratio * 10_000); // 20000 = 2倍

  if (ratio >= 2) return [{ type: "VOLUME_SPIKE", window: "H24", changeBps: ratioBps }];
  if (ratio <= 0.3) return [{ type: "VOLUME_DROP", window: "H24", changeBps: ratioBps }];
  return [];
}

// ---------------------------------------------------------------------------
// 将来価格予測 (トレンド外挿 + ボラティリティでレンジ算出)
// ---------------------------------------------------------------------------

export interface Forecast {
  forecast7: number | null;
  forecast30: number | null;
  forecast90: number | null;
  /** 30日予測のレンジ */
  low: number | null;
  high: number | null;
  /** 0-100 */
  confidence: number;
}

export function forecast(
  currentPrice: number | null,
  trend: TrendResult,
  volatilityBps: number | null,
  sampleSize: number,
): Forecast {
  if (currentPrice == null) {
    return { forecast7: null, forecast30: null, forecast90: null, low: null, high: null, confidence: 0 };
  }
  const dailyRate = trend.slopeBps / 10_000; // 価格比/日
  const project = (days: number) => Math.max(1, Math.round(currentPrice * (1 + dailyRate * days)));

  const f7 = project(7);
  const f30 = project(30);
  const f90 = project(90);

  // 信頼度: サンプルが多くボラティリティが低いほど高い
  const vol = volatilityBps ?? 2000;
  const volScore = clamp(100 - vol / 30, 0, 100); // 15%で50点付近
  const sampleScore = clamp(Math.log10(sampleSize + 1) * 33, 0, 100);
  const confidence = Math.round(volScore * 0.6 + sampleScore * 0.4);

  // レンジ: 30日予測 ± ボラティリティ
  const band = Math.round((f30 * (vol / 10_000)) || f30 * 0.1);
  return {
    forecast7: f7,
    forecast30: f30,
    forecast90: f90,
    low: Math.max(1, f30 - band),
    high: f30 + band,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// AI分析コメント (ルールベースの自然文生成)
// ---------------------------------------------------------------------------

export interface CommentInput {
  fair: FairValue;
  trend: TrendResult;
  score: ScoreResult;
  volumeAnomaly?: DetectedAnomaly;
  priceAnomalies: DetectedAnomaly[];
}

export function generateComment(c: CommentInput): string {
  const parts: string[] = [];
  const spikeUp = c.priceAnomalies.find((a) => a.type === "SPIKE_UP");
  const spikeDown = c.priceAnomalies.find((a) => a.type === "SPIKE_DOWN");

  if (c.fair.undervaluedRate && c.fair.undervaluedRate >= 1000) {
    parts.push(`適正価格より約${(c.fair.undervaluedRate / 100).toFixed(0)}%安く、割安圏にあります。`);
  } else if (c.fair.overvaluedRate && c.fair.overvaluedRate >= 1000) {
    parts.push(`適正価格より約${(c.fair.overvaluedRate / 100).toFixed(0)}%高く、割高圏です。高値掴みに注意してください。`);
  }

  if (spikeUp) {
    parts.push(`直近で急騰（${(spikeUp.changeBps / 100).toFixed(0)}%）しており、調整局面に入る可能性があります。`);
  } else if (spikeDown) {
    parts.push(`直近で急落（${(spikeDown.changeBps / 100).toFixed(0)}%）しています。反発の有無を見極めましょう。`);
  } else if (c.trend.trend === "UP") {
    parts.push("緩やかな上昇トレンドが継続しています。");
  } else if (c.trend.trend === "DOWN") {
    parts.push("下落トレンドが続いており、底打ちの確認が必要です。");
  }

  if (c.volumeAnomaly?.type === "VOLUME_SPIKE") {
    parts.push("売買数も急増しており、市場の注目が集まっています。");
  } else if (c.volumeAnomaly?.type === "VOLUME_DROP") {
    parts.push("出来高が大きく減少しており、流動性低下に注意が必要です。");
  }

  if (c.score.total >= 80) {
    parts.push("総合投資スコアは有望水準です。");
  } else if (c.score.total < 40) {
    parts.push("総合スコアは低く、投資妙味は限定的です。");
  }

  if (parts.length === 0) {
    return "目立った変動はなく、価格は安定して推移しています。";
  }
  return parts.join("");
}
