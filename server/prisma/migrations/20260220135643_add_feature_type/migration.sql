-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('SURVEY', 'VIDEO');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "videoSubscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "featureType" "FeatureType" NOT NULL DEFAULT 'SURVEY';

-- CreateIndex
CREATE INDEX "Payment_userId_featureType_status_idx" ON "Payment"("userId", "featureType", "status");
