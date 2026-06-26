-- 機械翻訳したアイテム名 (locale -> 名前) を保持する JSON カラム
ALTER TABLE "Item" ADD COLUMN "nameI18n" JSONB;
