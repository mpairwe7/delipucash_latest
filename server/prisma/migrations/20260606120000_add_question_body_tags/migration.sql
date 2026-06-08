-- Add optional rich body + tags to questions (Question.description / Question.tags).
-- description: nullable free-text body. tags: non-null text array, empty for existing rows.
ALTER TABLE "Question" ADD COLUMN "description" TEXT;
ALTER TABLE "Question" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
