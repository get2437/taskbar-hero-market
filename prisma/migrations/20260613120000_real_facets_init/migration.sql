-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('GEAR', 'MATERIAL');

-- CreateEnum
CREATE TYPE "Part" AS ENUM ('MAIN_WEAPON', 'SUB_WEAPON', 'ARMOR', 'HELMET', 'GLOVES', 'BOOTS', 'AMULET', 'RING', 'BRACER', 'EARRING', 'NONE');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('COSMIC', 'DIVINE', 'CELESTIAL', 'BEYOND', 'ARCANA', 'IMMORTAL', 'LEGENDARY', 'RARE', 'UNCOMMON', 'COMMON');

-- CreateEnum
CREATE TYPE "ClassType" AS ENUM ('KNIGHT', 'SLAYER', 'HUNTER', 'RANGER', 'SORCERER', 'PRIEST', 'NONE');

-- CreateEnum
CREATE TYPE "Trend" AS ENUM ('UP', 'DOWN', 'FLAT');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('DANGER', 'CAUTION', 'GOOD', 'PROMISING');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('S', 'A', 'B', 'C');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('SPIKE_UP', 'SPIKE_DOWN', 'VOLUME_SPIKE', 'VOLUME_DROP');

-- CreateEnum
CREATE TYPE "TimeWindow" AS ENUM ('H1', 'H24', 'D7', 'D30', 'D90');

-- CreateEnum
CREATE TYPE "AlertCondition" AS ENUM ('PRICE_BELOW', 'PRICE_ABOVE', 'CHANGE_UP', 'CHANGE_DOWN', 'SPIKE_UP', 'SPIKE_DOWN', 'VOLUME_SPIKE');

-- CreateEnum
CREATE TYPE "NotifyChannel" AS ENUM ('WEB', 'DISCORD', 'EMAIL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "appId" INTEGER NOT NULL DEFAULT 3678970,
    "marketHashName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "type" "ItemType" NOT NULL DEFAULT 'MATERIAL',
    "part" "Part" NOT NULL DEFAULT 'NONE',
    "grade" "Grade" NOT NULL DEFAULT 'COMMON',
    "classType" "ClassType" NOT NULL DEFAULT 'NONE',
    "level" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLatest" (
    "itemId" TEXT NOT NULL,
    "lowestPrice" INTEGER,
    "highestPrice" INTEGER,
    "medianPrice" INTEGER,
    "averagePrice" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "changePrev" INTEGER,
    "change7d" INTEGER,
    "change30d" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLatest_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lowestPrice" INTEGER,
    "highestPrice" INTEGER,
    "medianPrice" INTEGER,
    "averagePrice" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAnalysis" (
    "itemId" TEXT NOT NULL,
    "ma7" INTEGER,
    "ma30" INTEGER,
    "ma90" INTEGER,
    "volatility" INTEGER,
    "fairPrice" INTEGER,
    "undervaluedRate" INTEGER,
    "overvaluedRate" INTEGER,
    "trend" "Trend" NOT NULL DEFAULT 'FLAT',
    "investmentScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'CAUTION',
    "recommendation" "Recommendation" NOT NULL DEFAULT 'C',
    "scorePrice" INTEGER NOT NULL DEFAULT 0,
    "scoreVolume" INTEGER NOT NULL DEFAULT 0,
    "scoreStability" INTEGER NOT NULL DEFAULT 0,
    "scoreVolatility" INTEGER NOT NULL DEFAULT 0,
    "scorePopularity" INTEGER NOT NULL DEFAULT 0,
    "forecast7" INTEGER,
    "forecast30" INTEGER,
    "forecast90" INTEGER,
    "forecastLow" INTEGER,
    "forecastHigh" INTEGER,
    "forecastConf" INTEGER,
    "aiComment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemAnalysis_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "AnomalyType" NOT NULL,
    "window" "TimeWindow" NOT NULL,
    "changeBps" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#64748b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "folderId" TEXT,
    "memo" TEXT,
    "purchasePrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteStat" (
    "itemId" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "last24h" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteStat_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "condition" "AlertCondition" NOT NULL,
    "threshold" INTEGER,
    "channel" "NotifyChannel" NOT NULL DEFAULT 'WEB',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "NotifyChannel" NOT NULL DEFAULT 'WEB',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsOk" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "FetchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "gid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contents" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "feedLabel" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "translations" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("gid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_marketHashName_key" ON "Item"("marketHashName");

-- CreateIndex
CREATE INDEX "Item_type_idx" ON "Item"("type");

-- CreateIndex
CREATE INDEX "Item_part_idx" ON "Item"("part");

-- CreateIndex
CREATE INDEX "Item_grade_idx" ON "Item"("grade");

-- CreateIndex
CREATE INDEX "Item_classType_idx" ON "Item"("classType");

-- CreateIndex
CREATE INDEX "Item_level_idx" ON "Item"("level");

-- CreateIndex
CREATE INDEX "Item_active_idx" ON "Item"("active");

-- CreateIndex
CREATE INDEX "ItemLatest_lowestPrice_idx" ON "ItemLatest"("lowestPrice");

-- CreateIndex
CREATE INDEX "ItemLatest_quantity_idx" ON "ItemLatest"("quantity");

-- CreateIndex
CREATE INDEX "ItemLatest_change7d_idx" ON "ItemLatest"("change7d");

-- CreateIndex
CREATE INDEX "MarketSnapshot_itemId_createdAt_idx" ON "MarketSnapshot"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceHistory_itemId_timestamp_idx" ON "PriceHistory"("itemId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_itemId_timestamp_key" ON "PriceHistory"("itemId", "timestamp");

-- CreateIndex
CREATE INDEX "ItemAnalysis_investmentScore_idx" ON "ItemAnalysis"("investmentScore");

-- CreateIndex
CREATE INDEX "ItemAnalysis_undervaluedRate_idx" ON "ItemAnalysis"("undervaluedRate");

-- CreateIndex
CREATE INDEX "ItemAnalysis_recommendation_idx" ON "ItemAnalysis"("recommendation");

-- CreateIndex
CREATE INDEX "Anomaly_type_detectedAt_idx" ON "Anomaly"("type", "detectedAt");

-- CreateIndex
CREATE INDEX "Anomaly_itemId_detectedAt_idx" ON "Anomaly"("itemId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Favorite_folderId_idx" ON "Favorite"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_itemId_key" ON "Favorite"("userId", "itemId");

-- CreateIndex
CREATE INDEX "FavoriteStat_total_idx" ON "FavoriteStat"("total");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_itemId_idx" ON "PriceAlert"("itemId");

-- CreateIndex
CREATE INDEX "PriceAlert_enabled_idx" ON "PriceAlert"("enabled");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "FetchLog_kind_startedAt_idx" ON "FetchLog"("kind", "startedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- AddForeignKey
ALTER TABLE "ItemLatest" ADD CONSTRAINT "ItemLatest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAnalysis" ADD CONSTRAINT "ItemAnalysis_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteStat" ADD CONSTRAINT "FavoriteStat_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "PriceAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

