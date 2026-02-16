/*
  Warnings:

  - You are about to drop the column `isBookmarked` on the `Video` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userEmail,questionId]` on the table `QuestionAttempt` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "QuestionAttempt_userEmail_questionId_idx";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "isBookmarked";

-- CreateTable
CREATE TABLE "VideoLike" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoBookmark" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardQuestionAttempt" (
    "id" UUID NOT NULL,
    "userEmail" TEXT NOT NULL,
    "rewardQuestionId" UUID NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardQuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoLike_videoId_idx" ON "VideoLike"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoLike_userId_videoId_key" ON "VideoLike"("userId", "videoId");

-- CreateIndex
CREATE INDEX "VideoBookmark_videoId_idx" ON "VideoBookmark"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoBookmark_userId_videoId_key" ON "VideoBookmark"("userId", "videoId");

-- CreateIndex
CREATE INDEX "RewardQuestionAttempt_userEmail_attemptedAt_idx" ON "RewardQuestionAttempt"("userEmail", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardQuestionAttempt_userEmail_rewardQuestionId_key" ON "RewardQuestionAttempt"("userEmail", "rewardQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAttempt_userEmail_questionId_key" ON "QuestionAttempt"("userEmail", "questionId");

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoBookmark" ADD CONSTRAINT "VideoBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoBookmark" ADD CONSTRAINT "VideoBookmark_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardQuestionAttempt" ADD CONSTRAINT "RewardQuestionAttempt_rewardQuestionId_fkey" FOREIGN KEY ("rewardQuestionId") REFERENCES "RewardQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardQuestionAttempt" ADD CONSTRAINT "RewardQuestionAttempt_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "AppUser"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
