-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "experimentName" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "compareUrl" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvalRun_userId_createdAt_idx" ON "EvalRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EvalRun_youtubeId_createdAt_idx" ON "EvalRun"("youtubeId", "createdAt");

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
