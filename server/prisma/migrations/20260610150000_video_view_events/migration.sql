-- CreateTable
CREATE TABLE "VideoViewEvent" (
    "id" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "userId" UUID,
    "viewerKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dayBucket" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoViewEvent_videoId_viewerKey_kind_dayBucket_key" ON "VideoViewEvent"("videoId", "viewerKey", "kind", "dayBucket");

-- CreateIndex
CREATE INDEX "VideoViewEvent_videoId_createdAt_idx" ON "VideoViewEvent"("videoId", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoViewEvent" ADD CONSTRAINT "VideoViewEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoViewEvent" ADD CONSTRAINT "VideoViewEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
