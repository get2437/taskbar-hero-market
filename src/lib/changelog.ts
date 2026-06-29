/**
 * 更新履歴（人間向け）。アクセス数ページの下に新しい順で表示する。
 * title/detail は messages.ts のキー（多言語化のため）。at はローカル日時(JST想定)で、
 * 表示時に閲覧者の言語ロケールで「日付 時刻」に整形する。
 * 新しい更新を足すときは、配列の先頭に追記し、対応キーを messages.ts に足す。
 */
export interface ChangeEntry {
  /** ローカル日時 "YYYY-MM-DDTHH:mm"。表示はロケール整形。 */
  at: string;
  /** 見出し（messages.ts のキー） */
  title: string;
  /** 詳細（messages.ts のキー、任意） */
  detail?: string;
}

export const CHANGELOG: ChangeEntry[] = [
  { at: "2026-06-29T10:00", title: "cl.lang17.t", detail: "cl.lang17.d" },
  { at: "2026-06-29T09:51", title: "cl.steam429.t", detail: "cl.steam429.d" },
  { at: "2026-06-29T09:46", title: "cl.admintoken.t", detail: "cl.admintoken.d" },
  { at: "2026-06-29T09:39", title: "cl.favsep.t", detail: "cl.favsep.d" },
  { at: "2026-06-27T18:07", title: "cl.chart.t", detail: "cl.chart.d" },
  { at: "2026-06-27T08:45", title: "cl.gear.t", detail: "cl.gear.d" },
  { at: "2026-06-27T08:36", title: "cl.ogp.t", detail: "cl.ogp.d" },
  { at: "2026-06-26T21:54", title: "cl.itemi18n.t", detail: "cl.itemi18n.d" },
  { at: "2026-06-26T19:03", title: "cl.news.t", detail: "cl.news.d" },
  { at: "2026-06-26T15:19", title: "cl.nav.t", detail: "cl.nav.d" },
  { at: "2026-06-26T09:05", title: "cl.search.t", detail: "cl.search.d" },
];
