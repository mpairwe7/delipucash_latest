-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "amountDisbursed" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalBudget" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "survey_responses" ADD COLUMN     "amountAwarded" DOUBLE PRECISION,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentProvider" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus",
ADD COLUMN     "phoneNumber" TEXT;

-- CreateIndex
CREATE INDEX "survey_responses_paymentStatus_idx" ON "survey_responses"("paymentStatus");
