// ファセット絞り込み検索が効くか検証
async function q(params) {
  const url = `https://steamcommunity.com/market/search/render/?appid=3678970&norender=1&count=100&start=0&sort_column=name&${params}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
  const d = await r.json();
  return d;
}
for (const [label, params] of [
  ["class=knight", "category_3678970_class%5B%5D=tag_knight"],
  ["level=50", "category_3678970_level%5B%5D=tag_50"],
  ["parts=helmet", "category_3678970_parts%5B%5D=tag_helmet"],
  ["grade=immortal", "category_3678970_rarity%5B%5D=tag_immortal"],
]) {
  const d = await q(params);
  console.log(label, "-> total:", d.total_count, "page:", (d.results || []).length, "names:", (d.results || []).slice(0, 3).map((r) => r.name).join(" | "));
  await new Promise((r) => setTimeout(r, 1500));
}
