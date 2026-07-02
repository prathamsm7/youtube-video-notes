CREATE TABLE "EvalDataset" (
    "id" TEXT NOT NULL,
    "youtubeId" TEXT,
    "documentId" TEXT,
    "qaPairs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalDataset_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EvalDataset" ("id", "youtubeId", "documentId", "qaPairs", "createdAt", "updatedAt")
SELECT
    COALESCE('yt:' || "youtubeId", 'doc:' || "documentId") AS "id",
    "youtubeId",
    "documentId",
    jsonb_agg(
        jsonb_build_object(
            'question', question,
            'referenceAnswer', "referenceAnswer"
        )
        ORDER BY "sortOrder" ASC
    ) AS "qaPairs",
    MIN("createdAt") AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "EvalExample"
WHERE "youtubeId" IS NOT NULL OR "documentId" IS NOT NULL
GROUP BY "youtubeId", "documentId";

DROP TABLE "EvalExample";

CREATE UNIQUE INDEX "EvalDataset_youtubeId_key" ON "EvalDataset"("youtubeId");
CREATE UNIQUE INDEX "EvalDataset_documentId_key" ON "EvalDataset"("documentId");
