-- ニュースの出所 (公式ニュース / 掲示板の開発者投稿) を区別する
ALTER TABLE "NewsArticle" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'news';
CREATE INDEX "NewsArticle_source_publishedAt_idx" ON "NewsArticle"("source", "publishedAt");
