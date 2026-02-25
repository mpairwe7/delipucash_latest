-- Reconcile schema drift by codifying indexes that already exist in the database.
-- Safe for existing environments because IF NOT EXISTS is idempotent.

CREATE INDEX IF NOT EXISTS "Notification_userId_archived_createdAt_idx"
ON "Notification" ("userId", "archived", "createdAt");

CREATE INDEX IF NOT EXISTS "RewardQuestion_isActive_isInstantReward_isCompleted_created_idx"
ON "RewardQuestion" ("isActive", "isInstantReward", "isCompleted", "createdAt" DESC);
