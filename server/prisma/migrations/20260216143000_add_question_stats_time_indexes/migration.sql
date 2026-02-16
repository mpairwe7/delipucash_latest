-- Improves question stats endpoint filters by user + day range
CREATE INDEX IF NOT EXISTS "Response_userId_createdAt_idx"
ON "Response"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "QuestionAttempt_userEmail_attemptedAt_idx"
ON "QuestionAttempt"("userEmail", "attemptedAt");
