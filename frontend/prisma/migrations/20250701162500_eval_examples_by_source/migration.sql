-- AlterTable
ALTER TABLE "EvalExample"
ADD COLUMN "youtubeId" TEXT,
ADD COLUMN "documentId" TEXT;

-- Backfill existing examples to the current video-specific dataset
UPDATE "EvalExample"
SET "youtubeId" = 'ZhAz268Hdpw'
WHERE "youtubeId" IS NULL AND "documentId" IS NULL;

-- DropIndex
DROP INDEX "EvalExample_sortOrder_idx";

-- DropIndex
DROP INDEX "EvalExample_sortOrder_key";

-- CreateIndex
CREATE INDEX "EvalExample_youtubeId_sortOrder_idx" ON "EvalExample"("youtubeId", "sortOrder");

-- CreateIndex
CREATE INDEX "EvalExample_documentId_sortOrder_idx" ON "EvalExample"("documentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EvalExample_youtubeId_sortOrder_key" ON "EvalExample"("youtubeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EvalExample_documentId_sortOrder_key" ON "EvalExample"("documentId", "sortOrder");
