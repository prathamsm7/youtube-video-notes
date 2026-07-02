-- CreateEnum
CREATE TYPE "EvalJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "EvalJob" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "limit" INTEGER,
    "status" "EvalJobStatus" NOT NULL DEFAULT 'queued',
    "progressDone" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "resumeFrom" INTEGER NOT NULL DEFAULT 0,
    "partialResults" JSONB NOT NULL DEFAULT '[]',
    "lastError" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "evalRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "EvalJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvalJob_status_createdAt_idx" ON "EvalJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EvalJob_userId_createdAt_idx" ON "EvalJob"("userId", "createdAt");

-- One active eval job at a time (queued, running, or failed awaiting resume)
CREATE UNIQUE INDEX "EvalJob_one_active" ON "EvalJob" ((1))
WHERE "status" IN ('queued', 'running', 'failed');

-- AddForeignKey
ALTER TABLE "EvalJob" ADD CONSTRAINT "EvalJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalJob" ADD CONSTRAINT "EvalJob_evalRunId_fkey" FOREIGN KEY ("evalRunId") REFERENCES "EvalRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
