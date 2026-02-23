-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN     "defaultInstantRewardAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "defaultRegularRewardAmount" INTEGER NOT NULL DEFAULT 500;
