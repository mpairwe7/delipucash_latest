-- Update reward rate defaults: 125 UGX/point → 40 UGX/point
-- Regular reward: 500 UGX (4 pts) → 200 UGX (5 pts)
-- Min withdrawal: 50 pts = 6,250 UGX → 50 pts = 2,000 UGX

-- AlterTable: update column defaults for new rows
ALTER TABLE "AppConfig" ALTER COLUMN "pointsToCashNumerator" SET DEFAULT 2000;
ALTER TABLE "AppConfig" ALTER COLUMN "pointsToCashDenominator" SET DEFAULT 50;
ALTER TABLE "AppConfig" ALTER COLUMN "defaultRegularRewardAmount" SET DEFAULT 200;

-- Data migration: update existing singleton to new rate
-- WHERE guard: only update if still at old defaults (don't overwrite admin-customized values)
UPDATE "AppConfig"
SET "pointsToCashNumerator" = 2000,
    "pointsToCashDenominator" = 50,
    "defaultRegularRewardAmount" = 200,
    "updatedAt" = NOW()
WHERE "id" = 'singleton'
  AND "pointsToCashNumerator" = 2500
  AND "pointsToCashDenominator" = 20;
