-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('DECORATION', 'ENGRAVING', 'INSCRIPTION', 'CRAFTING', 'SOULSTONE', 'NONE');

-- CreateEnum
CREATE TYPE "StatKind" AS ENUM ('BASE', 'INHERENT', 'SPECIAL', 'MATERIAL_EFFECT');

-- CreateEnum
CREATE TYPE "StatUnit" AS ENUM ('FLAT', 'PCT', 'TEXT');

-- CreateEnum
CREATE TYPE "EffectTarget" AS ENUM ('WEAPON', 'ARMOR', 'ACCESSORY', 'NONE');

-- AlterTable
ALTER TABLE "Item"
    ADD COLUMN "materialCategory" "MaterialCategory" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "requiredLevel" INTEGER,
    ADD COLUMN "decoSlots" INTEGER,
    ADD COLUMN "engraveSlots" INTEGER,
    ADD COLUMN "inscriptSlots" INTEGER;

-- CreateTable
CREATE TABLE "ItemStatLine" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" "StatKind" NOT NULL,
    "statKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueMin" INTEGER,
    "valueMax" INTEGER,
    "unit" "StatUnit" NOT NULL DEFAULT 'FLAT',
    "tier" INTEGER,
    "appliesTo" "EffectTarget" NOT NULL DEFAULT 'NONE',
    "rawText" TEXT NOT NULL,

    CONSTRAINT "ItemStatLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemStatLine_statKey_valueMin_idx" ON "ItemStatLine"("statKey", "valueMin");

-- CreateIndex
CREATE INDEX "ItemStatLine_kind_idx" ON "ItemStatLine"("kind");

-- CreateIndex
CREATE INDEX "ItemStatLine_itemId_idx" ON "ItemStatLine"("itemId");

-- CreateIndex
CREATE INDEX "Item_materialCategory_idx" ON "Item"("materialCategory");

-- AddForeignKey
ALTER TABLE "ItemStatLine" ADD CONSTRAINT "ItemStatLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
