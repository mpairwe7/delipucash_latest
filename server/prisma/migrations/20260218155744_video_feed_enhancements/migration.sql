-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "completionsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "sharesCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VideoEvent" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "videoId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoFeedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoEvent_videoId_eventType_idx" ON "VideoEvent"("videoId", "eventType");

-- CreateIndex
CREATE INDEX "VideoEvent_userId_idx" ON "VideoEvent"("userId");

-- CreateIndex
CREATE INDEX "VideoEvent_sessionId_idx" ON "VideoEvent"("sessionId");

-- CreateIndex
CREATE INDEX "VideoEvent_createdAt_idx" ON "VideoEvent"("createdAt");

-- CreateIndex
CREATE INDEX "VideoFeedback_userId_idx" ON "VideoFeedback"("userId");

-- CreateIndex
CREATE INDEX "VideoFeedback_videoId_idx" ON "VideoFeedback"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoFeedback_userId_videoId_action_key" ON "VideoFeedback"("userId", "videoId", "action");

-- CreateIndex
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");

-- AddForeignKey
ALTER TABLE "VideoEvent" ADD CONSTRAINT "VideoEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoEvent" ADD CONSTRAINT "VideoEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFeedback" ADD CONSTRAINT "VideoFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFeedback" ADD CONSTRAINT "VideoFeedback_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
