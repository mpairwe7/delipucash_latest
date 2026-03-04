-- ============================================================
-- This migration is intentionally empty.
--
-- The fixes for Reward (userEmail→userId lookup) and
-- CreatorFollow (DELETE→OLD) have been folded into the
-- parent migration 20260302000000_add_listen_notify_triggers.
--
-- All trigger CREATE statements now use DROP IF EXISTS + CREATE
-- for full idempotency, so no separate fix migration is needed.
-- ============================================================

-- no-op
SELECT 1;
