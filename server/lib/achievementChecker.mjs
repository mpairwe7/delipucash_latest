/**
 * Achievement Checker — Reactive milestone detection.
 *
 * Evaluates user stats against predefined milestones and creates
 * ACHIEVEMENT notifications for newly crossed thresholds.
 * Deduplicates via Notification.type + metadata.achievementKey —
 * no separate Achievement model needed.
 *
 * Called fire-and-forget after key user actions (survey completion,
 * reward earned, redemption, stats fetch).
 */

import prisma from './prisma.mjs';
import { createNotificationFromTemplateHelper } from '../controllers/notificationController.mjs';

// ---------------------------------------------------------------------------
// Milestone definitions
// ---------------------------------------------------------------------------

const MILESTONES = [
  { key: 'first_survey',     name: 'Survey Pioneer',     field: 'surveysCompleted',   threshold: 1 },
  { key: 'surveys_5',        name: 'Survey Enthusiast',   field: 'surveysCompleted',   threshold: 5 },
  { key: 'surveys_25',       name: 'Survey Master',       field: 'surveysCompleted',   threshold: 25 },
  { key: 'first_question',   name: 'Curious Mind',        field: 'questionsAnswered',  threshold: 1 },
  { key: 'questions_25',     name: 'Knowledge Seeker',    field: 'questionsAnswered',  threshold: 25 },
  { key: 'streak_7',         name: 'Week Warrior',        field: 'currentStreak',      threshold: 7 },
  { key: 'streak_30',        name: 'Monthly Champion',    field: 'currentStreak',      threshold: 30 },
  { key: 'earnings_5000',    name: 'Rising Earner',       field: 'totalEarnings',      threshold: 5000 },
  { key: 'earnings_50000',   name: 'Top Earner',          field: 'totalEarnings',      threshold: 50000 },
  { key: 'first_withdrawal', name: 'First Cashout',       field: 'redemptionsCount',   threshold: 1 },
  { key: 'videos_50',        name: 'Video Explorer',      field: 'videosWatched',      threshold: 50 },
];

// ---------------------------------------------------------------------------
// Stats fetcher (lightweight — skips streak calculation by default)
// ---------------------------------------------------------------------------

async function fetchAchievementStats(userId, opts = {}) {
  const [
    surveysCompleted,
    questionsAnswered,
    totalEarningsAgg,
    redemptionsCount,
    videosWatched,
  ] = await Promise.all([
    prisma.surveyResponse.count({ where: { userId } }),
    prisma.questionAttempt.count({ where: { user: { id: userId } } }),
    prisma.reward.aggregate({ where: { user: { id: userId } }, _sum: { points: true } }),
    prisma.rewardRedemption.count({ where: { userId } }),
    prisma.videoEvent.count({ where: { userId, eventType: 'play_3s' } }),
  ]);

  return {
    surveysCompleted,
    questionsAnswered,
    totalEarnings: totalEarningsAgg._sum.points || 0,
    redemptionsCount,
    videosWatched,
    currentStreak: opts.currentStreak ?? 0, // Caller can pass pre-computed streak
  };
}

// ---------------------------------------------------------------------------
// Main checker
// ---------------------------------------------------------------------------

/**
 * Check all milestones for a user and create ACHIEVEMENT notifications
 * for any newly crossed thresholds.
 *
 * @param {string} userId
 * @param {object} [opts]
 * @param {number} [opts.currentStreak] - Pre-computed streak (avoids re-query)
 * @returns {Promise<string[]>} Array of newly unlocked achievement keys
 */
export async function checkAndUnlockAchievements(userId, opts = {}) {
  const stats = await fetchAchievementStats(userId, opts);

  // Find milestones where threshold is met
  const eligible = MILESTONES.filter((m) => (stats[m.field] ?? 0) >= m.threshold);
  if (eligible.length === 0) return [];

  // Batch-check which achievement notifications already exist for this user
  const existingNotifications = await prisma.notification.findMany({
    where: {
      userId,
      type: 'ACHIEVEMENT',
    },
    select: { metadata: true },
  });

  const existingKeys = new Set(
    existingNotifications
      .map((n) => n.metadata?.achievementKey)
      .filter(Boolean),
  );

  // Create notifications for new achievements only
  const newlyUnlocked = [];
  for (const milestone of eligible) {
    if (existingKeys.has(milestone.key)) continue;

    await createNotificationFromTemplateHelper(userId, 'ACHIEVEMENT', {
      achievement: milestone.name,
      achievementKey: milestone.key,
    }).catch(() => {});

    newlyUnlocked.push(milestone.key);
  }

  if (newlyUnlocked.length > 0) {
    console.log(`[achievements] User ${userId} unlocked: ${newlyUnlocked.join(', ')}`);
  }

  return newlyUnlocked;
}
