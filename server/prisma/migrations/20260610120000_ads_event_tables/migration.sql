-- AlterTable
ALTER TABLE "Ad" ADD COLUMN     "dailySpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dailySpendDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdImpression" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "adId" UUID NOT NULL,
    "userId" UUID,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "placement" TEXT,
    "viewable" BOOLEAN NOT NULL DEFAULT false,
    "viewDuration" INTEGER NOT NULL DEFAULT 0,
    "viewportPercentage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdClick" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "adId" UUID NOT NULL,
    "userId" UUID,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "placement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdImpression_eventId_key" ON "AdImpression"("eventId");

-- CreateIndex
CREATE INDEX "AdImpression_adId_createdAt_idx" ON "AdImpression"("adId", "createdAt");

-- CreateIndex
CREATE INDEX "AdImpression_userId_createdAt_idx" ON "AdImpression"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdClick_eventId_key" ON "AdClick"("eventId");

-- CreateIndex
CREATE INDEX "AdClick_adId_createdAt_idx" ON "AdClick"("adId", "createdAt");

-- CreateIndex
CREATE INDEX "AdClick_userId_createdAt_idx" ON "AdClick"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ad_isActive_status_placement_priority_idx" ON "Ad"("isActive", "status", "placement", "priority");

-- CreateIndex
CREATE INDEX "Ad_startDate_endDate_idx" ON "Ad"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

