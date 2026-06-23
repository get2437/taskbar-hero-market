// 購入/販売モード (サイト全体) — i18n と同方式の cookie ベース
export const MODES = ["buy", "sell"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_MODE: Mode = "buy";
export const MODE_COOKIE = "mode";

export function isMode(v: string | undefined | null): v is Mode {
  return v === "buy" || v === "sell";
}
