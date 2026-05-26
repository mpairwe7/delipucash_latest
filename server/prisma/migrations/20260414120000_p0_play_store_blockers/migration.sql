-- P0 Play Store blockers: account deletion, push tokens, MoMo-verified
-- numbers, device fingerprints, referral tracking table.
--
-- All changes are additive (nullable columns or defaults, new table, new
-- indexes, new FKs) so this is safe to apply on a live database — no existing
-- rows are rewritten and no queries break during the deploy window.

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'PAID');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedReason" TEXT,
ADD COLUMN     "expoPushToken" TEXT,
ADD COLUMN     "lastDeviceId" TEXT,
ADD COLUMN     "pushTokenUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedMomoNumbers" JSONB;

-- CreateTable
CREATE TABLE "Referral" (
    "id" UUID NOT NULL,
    "inviterId" UUID NOT NULL,
    "inviteeId" UUID NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardPoints" INTEGER NOT NULL DEFAULT 500,
    "qualifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_inviteeId_key" ON "Referral"("inviteeId");

-- CreateIndex
CREATE INDEX "Referral_inviterId_status_idx" ON "Referral"("inviterId", "status");

-- CreateIndex
CREATE INDEX "Referral_status_createdAt_idx" ON "Referral"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AppUser_deletedAt_idx" ON "AppUser"("deletedAt");

-- CreateIndex
CREATE INDEX "AppUser_expoPushToken_idx" ON "AppUser"("expoPushToken");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
