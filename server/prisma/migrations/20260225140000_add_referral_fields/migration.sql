-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredBy" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_referralCode_key" ON "AppUser"("referralCode");
