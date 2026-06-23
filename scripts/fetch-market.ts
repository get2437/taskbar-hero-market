/** 手動でSteam取得+保存を1回実行する。 npm run fetch:market */
import { searchAllItems } from "../src/lib/steam/fetch";
import { storeFetched } from "../src/lib/steam/store";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("[fetch] searching Steam market...");
  const items = await searchAllItems(2000);
  console.log(`[fetch] ${items.length} items found. storing...`);
  const ok = await storeFetched(items);
  console.log(`[fetch] stored ${ok} items.`);
}

main()
  .catch((e) => {
    console.error("[fetch] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
