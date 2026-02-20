-- CreateTable
CREATE TABLE "VideoShare" (
    "id" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "userId" UUID,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoShare_videoId_idx" ON "VideoShare"("videoId");

-- CreateIndex
CREATE INDEX "VideoShare_userId_idx" ON "VideoShare"("userId");

-- CreateIndex
CREATE INDEX "VideoShare_createdAt_idx" ON "VideoShare"("createdAt");

-- AddForeignKey
ALTER TABLE "VideoShare" ADD CONSTRAINT "VideoShare_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoShare" ADD CONSTRAINT "VideoShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
