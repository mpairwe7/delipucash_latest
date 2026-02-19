import prisma from '../lib/prisma.mjs';
import { publishEvent } from '../lib/eventBus.mjs';

// ---------------------------------------------------------------------------
// In-memory collaboration state
// Maps surveyId -> Map<userId, { firstName, avatar, lockedQuestionId, joinedAt }>
// ---------------------------------------------------------------------------
const activeSessions = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the session Map for a given survey, creating one if it doesn't exist.
 */
function getSession(surveyId) {
  if (!activeSessions.has(surveyId)) {
    activeSessions.set(surveyId, new Map());
  }
  return activeSessions.get(surveyId);
}

/**
 * Convert a session Map into a plain array suitable for JSON responses.
 */
function sessionToArray(session) {
  return Array.from(session.entries()).map(([userId, data]) => ({
    userId,
    firstName: data.firstName,
    avatar: data.avatar,
    lockedQuestionId: data.lockedQuestionId,
    joinedAt: data.joinedAt,
  }));
}

/**
 * Publish an SSE event to every editor currently in a survey session.
 * Uses individual publishEvent calls so each user gets the event in their
 * personal SSE stream.
 */
async function broadcastToSession(session, eventType, payload) {
  const userIds = Array.from(session.keys());
  const promises = userIds.map((uid) =>
    publishEvent(uid, eventType, payload).catch(() => {}),
  );
  await Promise.allSettled(promises);
}

/**
 * Verify that the requesting user is either the survey owner or has an
 * elevated role (ADMIN / MODERATOR). Returns the survey record on success,
 * or null after sending an error response.
 */
async function verifySurveyAccess(req, res) {
  const { surveyId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { id: true, userId: true },
  });

  if (!survey) {
    res.status(404).json({ success: false, message: 'Survey not found' });
    return null;
  }

  // Owner passes immediately
  if (survey.userId === userId) return survey;

  // Otherwise check for elevated role
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return null;
  }

  return survey;
}

// ---------------------------------------------------------------------------
// Controller functions
// ---------------------------------------------------------------------------

/**
 * POST /api/surveys/:surveyId/collab/join
 *
 * Add the authenticated user to the active editing session for a survey.
 * Fetches user profile from DB, publishes `survey.editor.join`, and returns
 * the current list of active editors.
 */
export async function joinSession(req, res) {
  try {
    const survey = await verifySurveyAccess(req, res);
    if (!survey) return; // response already sent

    const userId = req.user.id;
    const { surveyId } = req.params;

    // Fetch user profile for display in the session
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { firstName: true, avatar: true },
    });

    const session = getSession(surveyId);

    session.set(userId, {
      firstName: user?.firstName || 'Anonymous',
      avatar: user?.avatar || null,
      lockedQuestionId: null,
      joinedAt: new Date().toISOString(),
    });

    const editors = sessionToArray(session);

    // Notify all editors in the session
    await broadcastToSession(session, 'survey.editor.join', {
      surveyId,
      userId,
      firstName: user?.firstName || 'Anonymous',
      avatar: user?.avatar || null,
      editors,
    });

    return res.status(200).json({
      success: true,
      message: 'Joined editing session',
      editors,
    });
  } catch (error) {
    console.error('[SurveyCollab] joinSession error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join session',
      error: error.message,
    });
  }
}

/**
 * POST /api/surveys/:surveyId/collab/leave
 *
 * Remove the authenticated user from the active editing session.
 * Releases any question locks held by the user and publishes
 * `survey.editor.leave`.
 */
export async function leaveSession(req, res) {
  try {
    const survey = await verifySurveyAccess(req, res);
    if (!survey) return;

    const userId = req.user.id;
    const { surveyId } = req.params;

    const session = getSession(surveyId);

    // Capture any lock before removing the user so we can notify about it
    const userData = session.get(userId);
    const releasedQuestionId = userData?.lockedQuestionId || null;

    session.delete(userId);

    // Clean up empty sessions
    if (session.size === 0) {
      activeSessions.delete(surveyId);
    }

    const editors = sessionToArray(session);

    // Notify remaining editors
    if (session.size > 0) {
      await broadcastToSession(session, 'survey.editor.leave', {
        surveyId,
        userId,
        releasedQuestionId,
        editors,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Left editing session',
      releasedQuestionId,
    });
  } catch (error) {
    console.error('[SurveyCollab] leaveSession error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to leave session',
      error: error.message,
    });
  }
}

/**
 * POST /api/surveys/:surveyId/collab/lock
 *
 * Lock a specific question for editing. Body: `{ questionId }`.
 * Denies the request if the question is already locked by another user.
 * Publishes `survey.question.locked` on success.
 */
export async function lockQuestion(req, res) {
  try {
    const survey = await verifySurveyAccess(req, res);
    if (!survey) return;

    const userId = req.user.id;
    const { surveyId } = req.params;
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'questionId is required in the request body',
      });
    }

    const session = getSession(surveyId);

    if (!session.has(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You must join the editing session before locking a question',
      });
    }

    // Check if the question is already locked by another user
    for (const [editorId, data] of session.entries()) {
      if (data.lockedQuestionId === questionId && editorId !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Question is already locked by another editor',
          lockedBy: {
            userId: editorId,
            firstName: data.firstName,
          },
        });
      }
    }

    // Set the lock
    const userData = session.get(userId);
    userData.lockedQuestionId = questionId;
    session.set(userId, userData);

    // Notify all editors
    await broadcastToSession(session, 'survey.question.locked', {
      surveyId,
      questionId,
      lockedBy: {
        userId,
        firstName: userData.firstName,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Question locked',
      questionId,
    });
  } catch (error) {
    console.error('[SurveyCollab] lockQuestion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to lock question',
      error: error.message,
    });
  }
}

/**
 * POST /api/surveys/:surveyId/collab/unlock
 *
 * Release the authenticated user's question lock.
 * Publishes `survey.question.unlocked` on success.
 */
export async function unlockQuestion(req, res) {
  try {
    const survey = await verifySurveyAccess(req, res);
    if (!survey) return;

    const userId = req.user.id;
    const { surveyId } = req.params;

    const session = getSession(surveyId);

    if (!session.has(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You must join the editing session before unlocking a question',
      });
    }

    const userData = session.get(userId);
    const releasedQuestionId = userData.lockedQuestionId;

    if (!releasedQuestionId) {
      return res.status(400).json({
        success: false,
        message: 'You do not have any question locked',
      });
    }

    userData.lockedQuestionId = null;
    session.set(userId, userData);

    // Notify all editors
    await broadcastToSession(session, 'survey.question.unlocked', {
      surveyId,
      questionId: releasedQuestionId,
      unlockedBy: {
        userId,
        firstName: userData.firstName,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Question unlocked',
      questionId: releasedQuestionId,
    });
  } catch (error) {
    console.error('[SurveyCollab] unlockQuestion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlock question',
      error: error.message,
    });
  }
}

/**
 * GET /api/surveys/:surveyId/collab/editors
 *
 * Return the list of active editors for a survey from the in-memory Map.
 */
export async function getActiveEditors(req, res) {
  try {
    const survey = await verifySurveyAccess(req, res);
    if (!survey) return;

    const { surveyId } = req.params;

    const session = activeSessions.get(surveyId);
    const editors = session ? sessionToArray(session) : [];

    return res.status(200).json({
      success: true,
      editors,
    });
  } catch (error) {
    console.error('[SurveyCollab] getActiveEditors error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active editors',
      error: error.message,
    });
  }
}
