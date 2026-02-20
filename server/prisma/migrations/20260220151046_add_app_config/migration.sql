-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "surveyCompletionPoints" INTEGER NOT NULL DEFAULT 10,
    "pointsToCashNumerator" INTEGER NOT NULL DEFAULT 2500,
    "pointsToCashDenominator" INTEGER NOT NULL DEFAULT 20,
    "minWithdrawalPoints" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);
