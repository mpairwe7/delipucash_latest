-- AlterTable
ALTER TABLE "Livestream" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'livestream';

-- CreateIndex
CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

-- CreateIndex
CREATE INDEX "Question_isInstantReward_idx" ON "Question"("isInstantReward");

-- CreateIndex
CREATE INDEX "Response_questionId_idx" ON "Response"("questionId");
