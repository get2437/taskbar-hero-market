/** 分析エンジンを手動で1回実行する。 npm run analyze */
import { runAnalysis } from "../src/lib/analysis/engine";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("[analyze] running...");
  const r = await runAnalysis();
  console.log(`[analyze] analyzed=${r.analyzed} anomalies=${r.anomalies}`);
}

main()
  .catch((e) => {
    console.error("[analyze] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
