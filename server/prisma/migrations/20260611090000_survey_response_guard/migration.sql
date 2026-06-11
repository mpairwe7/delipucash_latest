-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "responsesSubmitted" INTEGER NOT NULL DEFAULT 0;

-- Backfill the denormalized counter from existing responses so the atomic
-- maxResponses guard starts from the true count.
UPDATE "Survey" s
SET "responsesSubmitted" = (
  SELECT COUNT(*) FROM "survey_responses" r WHERE r."surveyId" = s."id"
);
