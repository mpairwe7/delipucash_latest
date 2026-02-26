-- AlterTable
ALTER TABLE "RewardRedemption" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_idempotencyKey_key" ON "RewardRedemption"("idempotencyKey");
