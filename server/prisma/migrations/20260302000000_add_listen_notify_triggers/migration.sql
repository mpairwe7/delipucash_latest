-- ============================================================
-- PostgreSQL LISTEN/NOTIFY triggers for real-time SSE delivery
-- ============================================================
--
-- Two notification channels:
--   1. sse_events  — fires on SSEEvent INSERT (rich application events)
--   2. db_changes  — fires on INSERT/UPDATE of key business tables
--                    (lightweight cache-invalidation signals)
--
-- The server's LISTEN connection (pgNotify.mjs) receives these
-- and instantly pushes to connected SSE clients, replacing polling.
--
-- IMPORTANT: All trigger payloads MUST stay under 200 bytes (metadata only).
-- PostgreSQL pg_notify has a hard 8,000-byte limit. Never include full
-- row data — only userId, table, operation, id, type.
--
-- Idempotency: All triggers use DROP IF EXISTS before CREATE to support
-- safe re-runs (migration replays, manual fixes, dev resets).
-- ============================================================


-- -------------------------------------------------------
-- 1. SSEEvent trigger — instant delivery of app events
-- -------------------------------------------------------
-- Fires on every INSERT to the SSEEvent table.
-- Payload includes userId, event type, and sequence number
-- so the SSE controller can immediately flush for that user.

CREATE OR REPLACE FUNCTION notify_sse_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'sse_events',
    json_build_object(
      'userId', NEW."userId",
      'type',   NEW."type",
      'seq',    NEW."seq"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sse_event_notify ON "SSEEvent";
CREATE TRIGGER trg_sse_event_notify
  AFTER INSERT ON "SSEEvent"
  FOR EACH ROW
  EXECUTE FUNCTION notify_sse_event();


-- -------------------------------------------------------
-- 2. Generic business-table trigger function
-- -------------------------------------------------------
-- Fires a lightweight db_changes notification with:
--   table, operation, id, userId
-- Used as a safety net for mutations that bypass the app layer
-- (direct SQL, migrations, admin tools, cron jobs).
--
-- Handles both INSERT/UPDATE (uses NEW) and DELETE (uses OLD).
-- All tracked tables using this function MUST have "userId" and "id" columns.

CREATE OR REPLACE FUNCTION notify_db_change()
RETURNS trigger AS $$
DECLARE
  target_user_id text;
  row_data record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := OLD;
  ELSE
    row_data := NEW;
  END IF;

  target_user_id := row_data."userId"::text;

  IF target_user_id IS NOT NULL THEN
    PERFORM pg_notify(
      'db_changes',
      json_build_object(
        'userId',    target_user_id,
        'table',     TG_TABLE_NAME,
        'operation', TG_OP,
        'id',        row_data."id"::text,
        'type',      TG_TABLE_NAME || '.' || lower(TG_OP)
      )::text
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------
-- 3. Apply db_changes trigger to key business tables
-- -------------------------------------------------------

-- Notification table — new notifications, read/archive status
-- Optimization: skip triggers on trivial status-only updates (mark-read)
-- to avoid N per-row notifications on "mark all as read" batch operations.
CREATE OR REPLACE FUNCTION notify_notification_change()
RETURNS trigger AS $$
DECLARE
  target_user_id text;
BEGIN
  -- On UPDATE, skip notification if only read/readAt changed (mark-read)
  -- This prevents N triggers firing for "mark all as read" batch operations.
  IF TG_OP = 'UPDATE'
    AND OLD."read" IS DISTINCT FROM NEW."read"
    AND OLD."title" IS NOT DISTINCT FROM NEW."title"
    AND OLD."body" IS NOT DISTINCT FROM NEW."body"
    AND OLD."category" IS NOT DISTINCT FROM NEW."category"
  THEN
    RETURN NEW;
  END IF;

  target_user_id := NEW."userId"::text;
  IF target_user_id IS NOT NULL THEN
    PERFORM pg_notify(
      'db_changes',
      json_build_object(
        'userId',    target_user_id,
        'table',     'Notification',
        'operation', TG_OP,
        'id',        NEW."id"::text,
        'type',      'Notification.' || lower(TG_OP)
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_change ON "Notification";
CREATE TRIGGER trg_notification_change
  AFTER INSERT OR UPDATE ON "Notification"
  FOR EACH ROW
  EXECUTE FUNCTION notify_notification_change();

-- Payment table — subscription payment status changes
DROP TRIGGER IF EXISTS trg_payment_change ON "Payment";
CREATE TRIGGER trg_payment_change
  AFTER INSERT OR UPDATE ON "Payment"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();

-- RewardRedemption — withdrawal status changes
DROP TRIGGER IF EXISTS trg_reward_redemption_change ON "RewardRedemption";
CREATE TRIGGER trg_reward_redemption_change
  AFTER INSERT OR UPDATE ON "RewardRedemption"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();

-- SurveyResponse — survey completions (table name is @@map("survey_responses"))
DROP TRIGGER IF EXISTS trg_survey_response_change ON "survey_responses";
CREATE TRIGGER trg_survey_response_change
  AFTER INSERT OR UPDATE ON "survey_responses"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();

-- Comment — new video comments
DROP TRIGGER IF EXISTS trg_comment_change ON "Comment";
CREATE TRIGGER trg_comment_change
  AFTER INSERT ON "Comment"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();

-- Question — new community questions (userId is nullable; NULL userId is silently skipped)
DROP TRIGGER IF EXISTS trg_question_change ON "Question";
CREATE TRIGGER trg_question_change
  AFTER INSERT ON "Question"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();

-- Response — new question responses
DROP TRIGGER IF EXISTS trg_response_change ON "Response";
CREATE TRIGGER trg_response_change
  AFTER INSERT ON "Response"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();

-- VideoLike — notify video owner of engagement
DROP TRIGGER IF EXISTS trg_video_like_change ON "VideoLike";
CREATE TRIGGER trg_video_like_change
  AFTER INSERT ON "VideoLike"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();

-- ResponseReply — notify original responder of reply
DROP TRIGGER IF EXISTS trg_response_reply_change ON "ResponseReply";
CREATE TRIGGER trg_response_reply_change
  AFTER INSERT ON "ResponseReply"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();


-- -------------------------------------------------------
-- 4. Specialized trigger for tables with non-standard
--    userId columns (e.g., userEmail, followerId)
-- -------------------------------------------------------

-- Reward table uses userEmail → look up userId from AppUser.
-- The generic notify_db_change() would read NULL for "userId" and skip.
CREATE OR REPLACE FUNCTION notify_reward_change()
RETURNS trigger AS $$
DECLARE
  target_user_id text;
BEGIN
  SELECT id::text INTO target_user_id
  FROM "AppUser"
  WHERE email = NEW."userEmail"
  LIMIT 1;

  IF target_user_id IS NOT NULL THEN
    PERFORM pg_notify(
      'db_changes',
      json_build_object(
        'userId',    target_user_id,
        'table',     'Reward',
        'operation', TG_OP,
        'id',        NEW."id"::text,
        'type',      'Reward.' || lower(TG_OP)
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reward_change ON "Reward";
CREATE TRIGGER trg_reward_change
  AFTER INSERT OR UPDATE ON "Reward"
  FOR EACH ROW
  EXECUTE FUNCTION notify_reward_change();

-- InstantRewardWinner uses userEmail → look up userId from AppUser
CREATE OR REPLACE FUNCTION notify_instant_reward_winner()
RETURNS trigger AS $$
DECLARE
  target_user_id text;
BEGIN
  SELECT id::text INTO target_user_id
  FROM "AppUser"
  WHERE email = NEW."userEmail"
  LIMIT 1;

  IF target_user_id IS NOT NULL THEN
    PERFORM pg_notify(
      'db_changes',
      json_build_object(
        'userId',    target_user_id,
        'table',     'InstantRewardWinner',
        'operation', TG_OP,
        'id',        NEW."id"::text,
        'type',      'InstantRewardWinner.' || lower(TG_OP)
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_instant_reward_winner_change ON "InstantRewardWinner";
CREATE TRIGGER trg_instant_reward_winner_change
  AFTER INSERT OR UPDATE ON "InstantRewardWinner"
  FOR EACH ROW
  EXECUTE FUNCTION notify_instant_reward_winner();


-- CreatorFollow — notify the followed user (followingId) of follow/unfollow.
-- Handles both INSERT and DELETE (DELETE only has OLD, not NEW).
CREATE OR REPLACE FUNCTION notify_creator_follow()
RETURNS trigger AS $$
DECLARE
  row_data record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := OLD;
  ELSE
    row_data := NEW;
  END IF;

  PERFORM pg_notify(
    'db_changes',
    json_build_object(
      'userId',    row_data."followingId"::text,
      'table',     'CreatorFollow',
      'operation', TG_OP,
      'id',        row_data."id"::text,
      'type',      'CreatorFollow.' || lower(TG_OP)
    )::text
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_creator_follow_change ON "CreatorFollow";
CREATE TRIGGER trg_creator_follow_change
  AFTER INSERT OR DELETE ON "CreatorFollow"
  FOR EACH ROW
  EXECUTE FUNCTION notify_creator_follow();


-- -------------------------------------------------------
-- 5. Livestream status changes (time-critical for viewers)
-- -------------------------------------------------------
-- Livestream has userId column, so the generic function works.
-- Only fires on UPDATE (status changes: pending→live→ended).

DROP TRIGGER IF EXISTS trg_livestream_change ON "Livestream";
CREATE TRIGGER trg_livestream_change
  AFTER UPDATE ON "Livestream"
  FOR EACH ROW
  EXECUTE FUNCTION notify_db_change();
