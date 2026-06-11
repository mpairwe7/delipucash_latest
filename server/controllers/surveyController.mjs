import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { publishEvent } from '../lib/eventBus.mjs';
import { dispatchWebhooks } from '../lib/webhookDispatcher.mjs';
import { processMtnPayment, processAirtelPayment } from './paymentController.mjs';
import { getRewardConfig, pointsToUgx } from '../lib/rewardConfig.mjs';
import { createNotificationFromTemplateHelper } from './notificationController.mjs';
import { checkAndUnlockAchievements } from '../lib/achievementChecker.mjs';
import { getStore } from '../lib/memoryCache.mjs';
import { VALID_QUESTION_TYPES, normalizeQuestionType } from '../lib/surveyQuestionTypes.mjs';
import { validateConditionalLogic, remapConditionalLogicIds } from '../lib/surveyConditionalLogic.mjs';

// In-process cache for public survey lists. These responses carry no per-user
// fields and no signed URLs, so they are safe to cache by query params. 90s TTL
// keeps lists fresh-ish; date-bucket boundaries (running/upcoming/completed) may
// lag by up to one TTL, which is acceptable for a list view.
const surveyListCache = getStore('surveyList', 200);
const SURVEY_LIST_TTL_MS = 90 * 1000;

// ---------------------------------------------------------------------------
// Reactive survey-expiring notification (fire-and-forget, deduplicated)
// ---------------------------------------------------------------------------

async function checkSurveyExpiringNotifications(userId) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Surveys expiring within 24 hours that the user hasn't completed
  const expiringSurveys = await prisma.survey.findMany({
    where: {
      endDate: { gt: now, lte: in24h },
      startDate: { lte: now },
      SurveyResponse: { none: { userId } },
    },
    select: { id: true, title: true },
    take: 5, // Cap to avoid burst
  });

  for (const survey of expiringSurveys) {
    // Deduplicate: skip if already notified for this survey
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'SURVEY_EXPIRING',
        metadata: { path: ['surveyId'], equals: survey.id },
      },
      select: { id: true },
    });
    if (existing) continue;

    await createNotificationFromTemplateHelper(userId, 'SURVEY_EXPIRING', {
      surveyTitle: survey.title,
      timeLeft: '24 hours',
      surveyId: survey.id,
    }).catch(() => {});
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared validation for survey creation payloads (createSurvey + uploadSurvey).
 * Normalizes question types in place onto `normalizedType`. Returns null when
 * valid, or { status, body } to send. `textKey` differs between the two
 * endpoints' historical payload shapes ('question' vs 'text').
 */
function validateCreationPayload({ title, questions, startDate, endDate, textKey }) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return { status: 400, body: { message: 'Survey title is required' } };
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return { status: 400, body: { message: 'At least one question is required' } };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { status: 400, body: { message: 'Invalid date format for startDate or endDate' } };
  }
  if (end <= start) {
    return { status: 400, body: { message: 'End date must be after start date' } };
  }

  const invalidText = questions.findIndex(
    (q) => !q || typeof q[textKey] !== 'string' || q[textKey].trim().length === 0
  );
  if (invalidText !== -1) {
    return { status: 400, body: { message: `Question ${invalidText + 1} is missing its text` } };
  }

  const invalidTypes = [];
  for (const q of questions) {
    const normalized = normalizeQuestionType(q.type);
    if (!normalized) {
      invalidTypes.push(q.type);
    } else {
      q.normalizedType = normalized;
    }
  }
  if (invalidTypes.length > 0) {
    return {
      status: 400,
      body: {
        message: `Invalid question type(s): ${invalidTypes.map(String).join(', ')}`,
        validTypes: VALID_QUESTION_TYPES,
      },
    };
  }

  // Conditional logic: rules must reference EARLIER questions by the ids the
  // client used (builder clientIds). Synthetic fallback ids make unresolvable
  // references fail validation instead of being stored dead.
  const logicErrors = validateConditionalLogic(
    questions.map((q, i) => ({
      id: q.clientId ?? q.id ?? `__q${i}`,
      conditionalLogic: q.conditionalLogic ?? null,
    }))
  );
  if (logicErrors.length > 0) {
    return {
      status: 400,
      body: { message: 'Invalid conditional logic', errors: logicErrors },
    };
  }

  return null;
}

// Create a Survey
export const createSurvey = asyncHandler(async (req, res) => {
  const { surveyTitle, surveyDescription, questions, startDate, endDate, rewardAmount, maxResponses, totalBudget } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // No payload logging — question text can carry PII; log ids/counts only.
  console.log(`Incoming request: POST /surveys/create, userId: ${userId}, questions: ${Array.isArray(questions) ? questions.length : 0}`);

  // Shared validation: title/questions presence, dates, canonical question
  // types (legacy aliases like multiple_choice/textarea normalize to the
  // renderer vocabulary instead of being stored unrenderable).
  const invalid = validateCreationPayload({ title: surveyTitle, questions, startDate, endDate, textKey: 'question' });
  if (invalid) {
    return res.status(invalid.status).json(invalid.body);
  }

  // Validate budget if provided
  const parsedBudget = totalBudget ? parseFloat(totalBudget) : null;
  const parsedReward = rewardAmount || 2000;
  if (parsedBudget !== null) {
    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      return res.status(400).json({ message: 'Total budget must be a positive number' });
    }
    if (parsedBudget < parsedReward) {
      return res.status(400).json({ message: 'Total budget must be at least equal to the reward amount per response' });
    }
    if (maxResponses && parsedBudget < parsedReward * maxResponses) {
      return res.status(400).json({
        message: `Total budget (${parsedBudget}) is insufficient for ${maxResponses} responses at ${parsedReward} each. Minimum: ${parsedReward * maxResponses}`,
      });
    }
  }

  try {
    // Atomic: survey + questions in one transaction — a partial failure can no
    // longer leave an empty (question-less) survey behind.
    const uploadedQuestions = await prisma.$transaction(async (tx) => {
      const newSurvey = await tx.survey.create({
        data: {
          title: surveyTitle,
          description: surveyDescription,
          userId,
          rewardAmount: parsedReward,
          maxResponses: maxResponses || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          totalBudget: parsedBudget,
        },
      });

      const created = [];
      for (const q of questions) {
        created.push(
          await tx.uploadSurvey.create({
            data: {
              text: q.question,
              type: q.normalizedType,
              options: JSON.stringify(q.options || []),
              placeholder: q.placeholder || '',
              minValue: q.minValue || null,
              maxValue: q.maxValue || null,
              required: q.required ?? true,
              userId,
              surveyId: newSurvey.id,
            },
          })
        );
      }
      return created;
    });

    console.log(`Survey created: ${uploadedQuestions[0]?.surveyId}, questions: ${uploadedQuestions.length}`);

    res.status(201).json({
      message: 'Survey and questions created successfully.',
      questions: uploadedQuestions,
    });
  } catch (error) {
    console.error('Error creating survey and questions:', error);

    res.status(500).json({ message: 'Error creating survey and questions' });
  }
});


export const uploadSurvey = asyncHandler(async (req, res) => {
  const { title, description, questions, startDate, endDate, rewardAmount, maxResponses, totalBudget } = req.body;
  const userId = req.user?.id;

  // Log the incoming request (no payloads — question text can carry PII)
  console.log(`Incoming request: POST /api/surveys/upload, userId: ${userId}, questions: ${Array.isArray(questions) ? questions.length : 0}`);

  // Validation parity with createSurvey: title/questions presence, dates,
  // canonical question types, conditional-logic references (rules reference the
  // client-supplied per-question `clientId`).
  const invalid = validateCreationPayload({ title, questions, startDate, endDate, textKey: 'text' });
  if (invalid) {
    return res.status(invalid.status).json(invalid.body);
  }

  // Validate budget if provided
  const parsedBudget = totalBudget ? parseFloat(totalBudget) : null;
  const parsedReward = rewardAmount || 2000;
  if (parsedBudget !== null) {
    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      return res.status(400).json({ message: 'Total budget must be a positive number' });
    }
    if (parsedBudget < parsedReward) {
      return res.status(400).json({ message: 'Total budget must be at least equal to the reward amount per response' });
    }
    if (maxResponses && parsedBudget < parsedReward * maxResponses) {
      return res.status(400).json({
        message: `Total budget (${parsedBudget}) is insufficient for ${maxResponses} responses at ${parsedReward} each. Minimum: ${parsedReward * maxResponses}`,
      });
    }
  }

  try {
    // Atomic create + conditional-logic id remap.
    //
    // The builder references questions by client-side ids (q_<ts>_<n>) inside
    // conditionalLogic rules. The DB mints fresh UUIDs, so the rules MUST be
    // rewritten to the created ids — before this remap existed, every
    // app-created rule referenced ids that didn't exist and the logic was dead
    // (an `equals` show-rule hid its question forever). Questions are created
    // sequentially first (capturing clientId → uuid), then the ones with logic
    // get their rewritten rules in a second pass inside the same transaction.
    const uploadedQuestions = await prisma.$transaction(async (tx) => {
      const newSurvey = await tx.survey.create({
        data: {
          title,
          description,
          userId,
          rewardAmount: parsedReward,
          maxResponses: maxResponses || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          totalBudget: parsedBudget,
        },
      });

      const idMap = new Map(); // clientId -> created UUID
      const created = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const row = await tx.uploadSurvey.create({
          data: {
            text: q.text,
            type: q.normalizedType,
            options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
            placeholder: q.placeholder || '',
            minValue: q.minValue || null,
            maxValue: q.maxValue || null,
            required: q.required ?? true,
            conditionalLogic: null, // remapped + written in the second pass
            userId,
            surveyId: newSurvey.id,
          },
        });
        idMap.set(q.clientId ?? q.id ?? `__q${i}`, row.id);
        created.push(row);
      }

      for (let i = 0; i < questions.length; i++) {
        const logic = questions[i].conditionalLogic;
        if (!logic || !Array.isArray(logic.rules) || logic.rules.length === 0) continue;
        const remapped = remapConditionalLogicIds(logic, idMap);
        created[i] = await tx.uploadSurvey.update({
          where: { id: created[i].id },
          data: { conditionalLogic: remapped },
        });
      }

      return created;
    });

    console.log(`Survey uploaded: ${uploadedQuestions[0]?.surveyId}, questions: ${uploadedQuestions.length}`);

    res.status(201).json({
      message: 'Survey and questions uploaded successfully.',
      questions: uploadedQuestions,
    });
  } catch (error) {
    console.error('Error uploading survey and questions:', error);

    res.status(500).json({ message: 'Error uploading survey and questions' });
  }
});


// Get Survey by ID
export const getSurveyById = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;

  console.log('Fetching survey by ID:', surveyId);

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        uploads: true,  // Include related questions
      },
      // Prisma Accelerate: Cache surveys for 5 min, serve stale for 1 min while revalidating
    });

    if (!survey) {
      console.error('Survey not found:', surveyId);
      return res.status(404).json({ message: 'Survey not found' });
    }

    console.log('Survey fetched successfully:', survey);
    res.status(200).json(survey);
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ message: 'Error fetching survey' });
  }
});

// Update a Survey
export const updateSurvey = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { title, description, startDate, endDate, questions, rewardAmount, maxResponses } = req.body;
  const userId = req.user?.id;

  console.log('Updating survey:', surveyId);

  try {
    // Verify ownership before allowing update
    const existingSurvey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { userId: true, startDate: true, endDate: true },
    });

    if (!existingSurvey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    if (existingSurvey.userId !== userId) {
      return res.status(403).json({ message: 'Access denied. You do not own this survey.' });
    }

    // Validate the COMBINED window whenever either date changes — a single-sided
    // update used to skip validation entirely (could set end < start).
    if (startDate !== undefined || endDate !== undefined) {
      const start = startDate !== undefined ? new Date(startDate) : existingSurvey.startDate;
      const end = endDate !== undefined ? new Date(endDate) : existingSurvey.endDate;
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      if (end <= start) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
    }

    // Validate question types up front (canonicalized like creation)
    if (questions && questions.length > 0) {
      for (const q of questions) {
        const normalized = normalizeQuestionType(q.type);
        if (!normalized) {
          return res.status(400).json({
            message: `Invalid question type: ${String(q.type)}`,
            validTypes: VALID_QUESTION_TYPES,
          });
        }
        q.normalizedType = normalized;
      }
    }

    // Structural-edit lock: once a survey has responses, answers are keyed by
    // question id + option TEXT — changing structure silently corrupts every
    // existing response and the analytics built on them. Metadata edits (title,
    // description, dates, reward, cap) remain allowed; ending a survey early
    // via endDate is the supported "close it" path.
    if (questions && questions.length > 0) {
      const responseCount = await prisma.surveyResponse.count({ where: { surveyId } });
      if (responseCount > 0) {
        return res.status(409).json({
          code: 'EDIT_LOCKED',
          message: 'This survey already has responses — its questions can no longer be edited. You can still update the title, description, dates, or end it early.',
        });
      }

      // Validate conditional logic against the survey's FULL ordered question
      // list (payload edits merged over the persisted questions, new questions
      // appended) — the creation paths validate; the update path must too, or
      // a partial update could store forward references/cycles/unknown
      // operators that the submit-time evaluator then chokes on.
      const existingQuestions = await prisma.uploadSurvey.findMany({
        where: { surveyId },
        select: { id: true, conditionalLogic: true },
        orderBy: { createdAt: 'asc' },
      });
      const payloadById = new Map(questions.filter((q) => q.id).map((q) => [q.id, q]));
      const merged = existingQuestions.map((e) => {
        const incoming = payloadById.get(e.id);
        return incoming
          ? { id: e.id, conditionalLogic: incoming.conditionalLogic ?? null }
          : e;
      });
      for (const q of questions) {
        if (!q.id) merged.push({ id: `__new_${merged.length}`, conditionalLogic: q.conditionalLogic ?? null });
      }
      const logicErrors = validateConditionalLogic(merged);
      if (logicErrors.length > 0) {
        return res.status(400).json({ message: 'Invalid conditional logic', errors: logicErrors });
      }
    }

    // Build update data dynamically to only update provided fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (rewardAmount !== undefined) updateData.rewardAmount = rewardAmount;
    if (maxResponses !== undefined) updateData.maxResponses = maxResponses;

    // Survey metadata + question writes are atomic. Question updates are scoped
    // to THIS survey via updateMany({ id, surveyId }) — the previous unscoped
    // update({ where: { id: q.id } }) let a caller pass question ids belonging
    // to OTHER surveys and tamper with them (IDOR).
    const updatedSurvey = await prisma.$transaction(async (tx) => {
      const updated = await tx.survey.update({
        where: { id: surveyId },
        data: updateData,
      });

      if (questions && questions.length > 0) {
        const unknownIds = [];
        for (const q of questions) {
          const data = {
            text: q.text,
            type: q.normalizedType,
            options: JSON.stringify(q.options || []),
            placeholder: q.placeholder || '',
            minValue: q.minValue || null,
            maxValue: q.maxValue || null,
            required: q.required ?? true,
            conditionalLogic: q.conditionalLogic ?? null,
          };
          if (q.id) {
            const result = await tx.uploadSurvey.updateMany({
              where: { id: q.id, surveyId },
              data,
            });
            if (result.count === 0) unknownIds.push(q.id);
          } else {
            await tx.uploadSurvey.create({
              data: { ...data, userId: updated.userId, surveyId: updated.id },
            });
          }
        }
        if (unknownIds.length > 0) {
          const err = new Error('unknown question ids');
          err.unknownQuestionIds = unknownIds;
          throw err; // rolls back the whole update
        }
      }

      return updated;
    });

    console.log('Survey updated successfully:', updatedSurvey.id);
    res.status(200).json({ message: 'Survey updated successfully', survey: updatedSurvey });
  } catch (error) {
    if (error?.unknownQuestionIds) {
      return res.status(400).json({
        code: 'UNKNOWN_QUESTION_IDS',
        message: 'Some question ids do not belong to this survey.',
        ids: error.unknownQuestionIds,
      });
    }
    console.error('Error updating survey:', error);
    res.status(500).json({ message: 'Error updating survey' });
  }
});

// Delete a Survey
export const deleteSurvey = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const userId = req.user?.id;

  console.log('Deleting survey:', surveyId);

  try {
    // Verify ownership before allowing delete
    const existingSurvey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { userId: true },
    });

    if (!existingSurvey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    if (existingSurvey.userId !== userId) {
      return res.status(403).json({ message: 'Access denied. You do not own this survey.' });
    }

    // A survey with responses cannot be deleted: SurveyResponse rows are the
    // respondents' earning/audit records (points were credited against them and
    // they carry payment fields), and the FK has no cascade — the old code
    // 500'd here on P2003 after already deleting the questions. Owners should
    // end the survey early (PUT endDate) instead.
    const responseCount = await prisma.surveyResponse.count({ where: { surveyId } });
    if (responseCount > 0) {
      return res.status(409).json({
        code: 'SURVEY_HAS_RESPONSES',
        message: `This survey has ${responseCount} response(s) and cannot be deleted — respondents' earning records must be preserved. End the survey early instead (update its end date).`,
      });
    }

    // Collect R2 keys BEFORE the delete (SurveyFileUpload cascades with the
    // survey), but only delete the objects AFTER the DB commit — storage
    // cleanup must never run for a delete that then fails.
    const fileUploads = await prisma.surveyFileUpload.findMany({
      where: { surveyId },
      select: { r2Key: true },
    });

    // Atomic: questions (no DB cascade) + survey in one transaction — a crash
    // between the two can no longer leave a question-less survey behind.
    // SurveyFileUpload + SurveyWebhook cascade at the DB.
    await prisma.$transaction([
      prisma.uploadSurvey.deleteMany({ where: { surveyId } }),
      prisma.survey.delete({ where: { id: surveyId } }),
    ]);

    // Best-effort storage cleanup — must never fail the request.
    if (fileUploads.length > 0) {
      const { deleteFile } = await import('../lib/r2.mjs');
      await Promise.allSettled(
        fileUploads.map(f => deleteFile(f.r2Key).catch(() => {}))
      );
    }

    console.log('Survey deleted successfully:', surveyId);
    res.status(200).json({ message: 'Survey deleted successfully' });
  } catch (error) {
    // Race backstop: a response landed between the count and the delete
    if (error?.code === 'P2003') {
      return res.status(409).json({
        code: 'SURVEY_HAS_RESPONSES',
        message: 'This survey has responses and cannot be deleted — end it early instead.',
      });
    }
    console.error('Error deleting survey:', error);
    res.status(500).json({ message: 'Error deleting survey' });
  }
});

/**
 * Check if user has already attempted a survey
 * Industry standard: Single attempt per user per survey
 */
export const checkSurveyAttempt = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      message: 'Authentication required',
      hasAttempted: false
    });
  }

  try {
    const existingResponse = await prisma.surveyResponse.findFirst({
      where: {
        surveyId,
        userId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      hasAttempted: !!existingResponse,
      attemptedAt: existingResponse?.createdAt || null,
      message: existingResponse 
        ? 'You have already completed this survey' 
        : 'Survey is available for attempt',
    });
  } catch (error) {
    console.error('Error checking survey attempt:', error);
    res.status(500).json({
      message: 'Error checking survey attempt',
      hasAttempted: false,
    });
  }
});

export const submitSurveyResponse = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { responses, answers } = req.body;
  const userId = req.user?.id;

  // Accept either "responses" or "answers" key for backward compatibility
  const responseData = responses || answers;

  console.log('Submitting survey response for survey:', surveyId);
  console.log('User ID:', userId);

  if (!userId) {
    return res.status(401).json({
      success: false,
      submitted: false,
      message: 'Authentication required to submit a survey response.',
    });
  }

  if (!responseData || typeof responseData !== 'object' || Object.keys(responseData).length === 0) {
    return res.status(400).json({
      success: false,
      submitted: false,
      message: 'Survey responses are required and must contain at least one answer.',
    });
  }

  try {
    // Verify survey exists and is still active
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { uploads: true },
    });

    if (!survey) {
      return res.status(404).json({
        success: false,
        submitted: false,
        message: 'Survey not found.',
      });
    }

    // Check if survey is within its valid date range
    const now = new Date();
    if (survey.startDate && new Date(survey.startDate) > now) {
      return res.status(400).json({
        success: false,
        submitted: false,
        message: 'This survey has not started yet.',
      });
    }
    if (survey.endDate && new Date(survey.endDate) < now) {
      return res.status(410).json({
        success: false,
        submitted: false,
        message: 'This survey has ended and is no longer accepting responses.',
      });
    }

    // Industry Standard: Check for existing attempt (single attempt per user)
    const existingResponse = await prisma.surveyResponse.findFirst({
      where: {
        surveyId,
        userId,
      },
    });

    if (existingResponse) {
      console.log('User has already attempted this survey:', existingResponse.id);
      return res.status(409).json({
        success: false,
        submitted: false,
        message: 'You have already completed this survey. Only one attempt is allowed per user.',
        alreadyAttempted: true,
        attemptedAt: existingResponse.createdAt,
      });
    }

    // Validate that all required AND visible questions have answers.
    // Questions hidden by conditional logic are excluded from required validation.
    const allQuestions = survey.uploads || [];
    const requiredQuestions = allQuestions.filter(q => q.required === true);
    const answeredIds = Object.keys(responseData);

    // Helper: evaluate if a question is visible given current answers and conditional logic
    const isQuestionVisible = (question) => {
      const logic = question.conditionalLogic;
      if (!logic || !logic.rules || logic.rules.length === 0) return true;

      const evaluateRule = (rule) => {
        const answer = responseData[rule.sourceQuestionId];
        switch (rule.operator) {
          case 'is_empty':
            return answer == null || answer === '' || (Array.isArray(answer) && answer.length === 0);
          case 'is_not_empty':
            return answer != null && answer !== '' && !(Array.isArray(answer) && answer.length === 0);
          case 'equals':
            return Array.isArray(answer) ? answer.includes(String(rule.value)) : String(answer) === String(rule.value);
          case 'not_equals':
            return Array.isArray(answer) ? !answer.includes(String(rule.value)) : String(answer) !== String(rule.value);
          case 'contains':
            return String(answer ?? '').toLowerCase().includes(String(rule.value).toLowerCase());
          case 'greater_than':
            return !isNaN(Number(answer)) && !isNaN(Number(rule.value)) && Number(answer) > Number(rule.value);
          case 'less_than':
            return !isNaN(Number(answer)) && !isNaN(Number(rule.value)) && Number(answer) < Number(rule.value);
          default:
            return true;
        }
      };

      return logic.logicType === 'all'
        ? logic.rules.every(evaluateRule)
        : logic.rules.some(evaluateRule);
    };

    const missingRequired = requiredQuestions
      .filter(q => isQuestionVisible(q)) // Only check visible (non-hidden) questions
      .filter(q => !answeredIds.includes(q.id) || responseData[q.id] === '' || responseData[q.id] === null || responseData[q.id] === undefined)
      .map(q => q.id);

    if (missingRequired.length > 0) {
      return res.status(400).json({
        success: false,
        submitted: false,
        message: `Please answer all required questions. ${missingRequired.length} required question(s) unanswered.`,
        missingQuestionIds: missingRequired,
      });
    }

    // Award fixed points from global config (computed before the transaction)
    const rewardConfig = await getRewardConfig();
    const pointsAwarded = rewardConfig.surveyCompletionPoints;
    const cashEquivalent = pointsToUgx(pointsAwarded, rewardConfig);

    // Atomically persist the response AND credit points in a single transaction.
    // If the points increment fails, the response create rolls back too — so the
    // user can simply retry instead of being permanently locked out by the
    // @@unique([userId, surveyId]) constraint with their points never granted.
    const surveyResponse = await prisma.$transaction(async (tx) => {
      // Atomic maxResponses guard (the ads budget-guard pattern): the cap
      // condition and the counter increment are ONE statement, so two racing
      // submissions at capacity can't both pass. Surveys without a cap still
      // increment the denormalized counter. A duplicate-attempt rollback
      // (P2002 below) undoes the increment with the rest of the transaction.
      const guard = await tx.survey.updateMany({
        where: {
          id: surveyId,
          ...(survey.maxResponses != null ? { responsesSubmitted: { lt: survey.maxResponses } } : {}),
        },
        data: { responsesSubmitted: { increment: 1 } },
      });
      if (guard.count === 0) {
        const full = new Error('Survey is full');
        full.surveyFull = true;
        throw full;
      }

      const created = await tx.surveyResponse.create({
        data: {
          userId,
          surveyId,
          responses: JSON.stringify(responseData),
          completedAt: new Date(),
        },
      });

      if (pointsAwarded > 0) {
        await tx.appUser.update({
          where: { id: userId },
          data: { points: { increment: pointsAwarded } },
        });
      }

      return created;
    });

    if (pointsAwarded > 0) {
      console.log(`Awarded ${pointsAwarded} points to user ${userId}`);
    }

    console.log('Survey response submitted successfully:', surveyResponse.id);

    // SSE: Notify survey owner of new response
    if (survey.userId && survey.userId !== userId) {
      const responseCount = await prisma.surveyResponse.count({ where: { surveyId } });
      publishEvent(survey.userId, 'survey.response', {
        surveyId,
        responseCount,
      }).catch(() => {});
    }

    // SSE: Notify submitter of completion + reward
    if (pointsAwarded > 0) {
      publishEvent(userId, 'survey.completed', {
        surveyId,
        pointsAwarded,
        cashEquivalent,
      }).catch(() => {});

      createNotificationFromTemplateHelper(userId, 'SURVEY_COMPLETED', {
        surveyTitle: survey.title,
        points: pointsAwarded,
      }).catch(() => {});

      checkAndUnlockAchievements(userId).catch(() => {});
    }

    // Webhook: Fire response.submitted event
    dispatchWebhooks(surveyId, 'response.submitted', {
      surveyId,
      responseId: surveyResponse.id,
      respondentId: userId,
      submittedAt: new Date().toISOString(),
    }).catch(() => {});

    res.status(201).json({
      success: true,
      submitted: true,
      message: 'Survey response submitted successfully!',
      pointsAwarded,
      cashEquivalent,
      responseId: surveyResponse.id,
      submittedAt: surveyResponse.createdAt,
    });
  } catch (error) {
    // Survey reached its response cap (atomic guard rejected the increment)
    if (error?.surveyFull) {
      return res.status(410).json({
        success: false,
        submitted: false,
        code: 'SURVEY_FULL',
        message: 'This survey has reached its maximum number of responses and is no longer accepting submissions.',
      });
    }
    // Handle duplicate submission (race condition hitting DB unique constraint)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        submitted: false,
        message: 'You have already completed this survey. Only one attempt is allowed per user.',
        alreadyAttempted: true,
      });
    }
    console.error('Error submitting survey response:', error);
    res.status(500).json({
      success: false,
      submitted: false,
      message: 'Error submitting survey response',
    });
  }
});

// Get Survey Responses (with pagination, owner/admin only)
export const getSurveyResponses = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 100));
  const requestingUserId = req.user?.id;

  // Ownership check: only survey owner or admin/moderator can view responses
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { userId: true },
  });

  if (!survey) {
    return res.status(404).json({ success: false, message: 'Survey not found' });
  }

  if (survey.userId !== requestingUserId) {
    const user = await prisma.appUser.findUnique({
      where: { id: requestingUserId },
      select: { role: true },
    });
    if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  const skip = (page - 1) * limit;

  try {
    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: { surveyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.surveyResponse.count({ where: { surveyId } }),
    ]);

    res.status(200).json({
      success: true,
      data: responses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    res.status(500).json({ message: 'Error fetching survey responses' });
  }
});

// Get Surveys by Status (running or upcoming)
export const getSurveysByStatus = asyncHandler(async (req, res) => {
  console.log('Request received to get surveys by status');
  const { status } = req.params; // 'running' or 'upcoming'
  console.log(`Status requested: ${status}`);

  const currentDate = new Date();
  console.log(`Current date: ${currentDate}`);

  let whereClause = {};

  if (status === 'running') {
    console.log('Filtering for running surveys');
    // Surveys that are currently running
    whereClause = {
      startDate: { lte: currentDate }, // Surveys that have started
      endDate: { gte: currentDate }, // Surveys that have not ended
    };
  } else if (status === 'upcoming') {
    console.log('Filtering for upcoming surveys');
    // Surveys that are upcoming
    whereClause = {
      startDate: { gt: currentDate }, // Surveys that have not started yet
    };
  } else if (status === 'completed') {
    console.log('Filtering for completed surveys');
    whereClause = {
      endDate: { lt: currentDate }, // Surveys that have ended
    };
  } else {
    console.error(`Invalid status provided: ${status}`);
    return res.status(400).json({ message: 'Invalid status. Use "running", "upcoming", or "completed".' });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 100));
  const skip = (page - 1) * limit;

  // Fire-and-forget notification check runs regardless of cache hit/miss so it
  // is never skipped when the list payload is served from cache.
  if (status === 'running' && req.user?.id) {
    checkSurveyExpiringNotifications(req.user.id).catch(() => {});
  }

  const cacheKey = `byStatus:${status}:${page}:${limit}`;
  const cachedPayload = surveyListCache.get(cacheKey);
  if (cachedPayload) return res.json(cachedPayload);

  try {
    const [surveys, total] = await Promise.all([
      prisma.survey.findMany({
        where: whereClause,
        include: {
          _count: { select: { uploads: true, SurveyResponse: true } },
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.survey.count({ where: whereClause }),
    ]);

    console.log(`Surveys fetched: ${surveys.length} of ${total}`);
    const payload = {
      success: true,
      data: surveys.map(s => ({
        ...s,
        questionsCount: s._count.uploads,
        responsesCount: s._count.SurveyResponse,
        _count: undefined,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
    surveyListCache.set(cacheKey, payload, SURVEY_LIST_TTL_MS);
    res.json(payload);
  } catch (error) {
    console.error('Error retrieving surveys:', error);
    res.status(500).json({ message: 'Error retrieving surveys' });
  }
});

// Get All Surveys
export const getAllSurveys = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 100));
  const { status } = req.query;
  const skip = (page - 1) * limit;
  const currentDate = new Date();
  
  let whereClause = {};
  
  // Optional status filter
  if (status === 'running') {
    whereClause = {
      startDate: { lte: currentDate },
      endDate: { gte: currentDate },
    };
  } else if (status === 'upcoming') {
    whereClause = {
      startDate: { gt: currentDate },
    };
  } else if (status === 'completed') {
    whereClause = {
      endDate: { lt: currentDate },
    };
  }
  // If no status, return all surveys
  
  const cacheKey = `all:${status || ''}:${page}:${limit}`;
  const cachedPayload = surveyListCache.get(cacheKey);
  if (cachedPayload) return res.json(cachedPayload);

  try {
    const [surveys, total] = await Promise.all([
      prisma.survey.findMany({
        where: whereClause,
        include: {
          _count: { select: { uploads: true, SurveyResponse: true } },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.survey.count({ where: whereClause }),
    ]);

    console.log(`Surveys fetched: ${surveys.length} of ${total}`);

    const payload = {
      success: true,
      data: surveys.map(s => ({
        ...s,
        questionsCount: s._count.uploads,
        responsesCount: s._count.SurveyResponse,
        _count: undefined,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
    surveyListCache.set(cacheKey, payload, SURVEY_LIST_TTL_MS);
    res.json(payload);
  } catch (error) {
    console.error('Error retrieving all surveys:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving surveys',
    });
  }
});

// Get Survey Analytics (owner/admin only, optimized with sampling)
export const getSurveyAnalytics = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const requestingUserId = req.user?.id;

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { uploads: true },
    });

    if (!survey) {
      return res.status(404).json({ success: false, message: 'Survey not found' });
    }

    // Ownership check: only survey owner or admin/moderator
    if (survey.userId !== requestingUserId) {
      const user = await prisma.appUser.findUnique({
        where: { id: requestingUserId },
        select: { role: true },
      });
      if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Use count instead of loading all responses
    const totalResponses = await prisma.surveyResponse.count({ where: { surveyId } });

    // Completion rate: responses / maxResponses (or 100% if no cap)
    const completionRate = survey.maxResponses
      ? Math.min((totalResponses / survey.maxResponses) * 100, 100)
      : 100;

    // Real average completion time from completedAt field (sample last 100)
    const timedResponses = await prisma.surveyResponse.findMany({
      where: { surveyId, completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    const avgTime = timedResponses.length > 0
      ? Math.round(
          timedResponses.reduce((sum, r) =>
            sum + (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / 1000, 0
          ) / timedResponses.length
        )
      : 0;

    // Responses grouped by day (last 30 days). Truncate to day IN POSTGRES so the
    // DB returns at most ~30 rows. Grouping by the raw createdAt timestamp would
    // return one group per response (millisecond precision) and push the rollup
    // into JS memory. to_char(...) returns a plain 'YYYY-MM-DD' string, avoiding
    // any Date/timezone parsing ambiguity from the pg ::date type.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyRows = await prisma.$queryRaw`
      SELECT to_char(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM survey_responses
      WHERE "surveyId" = ${surveyId}::uuid AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY day
      ORDER BY day
    `;
    const responsesByDay = dailyRows.map((r) => ({
      date: r.day,
      count: Number(r.count),
    }));

    // Sample responses for per-question distribution (max 500)
    const SAMPLE_SIZE = 500;
    const sampledResponses = await prisma.surveyResponse.findMany({
      where: { surveyId },
      select: { responses: true },
      take: SAMPLE_SIZE,
      orderBy: { createdAt: 'desc' },
    });

    const questionStats = (survey.uploads || []).map(q => {
      const dist = {};
      sampledResponses.forEach(r => {
        let parsed;
        try { parsed = typeof r.responses === 'string' ? JSON.parse(r.responses) : r.responses; }
        catch { parsed = {}; }
        const val = parsed?.[q.id];
        if (val !== undefined && val !== null && val !== '') {
          const key = Array.isArray(val) ? val.join(', ') : String(val);
          dist[key] = (dist[key] || 0) + 1;
        }
      });

      const total = Object.values(dist).reduce((sum, c) => sum + c, 0);
      return {
        questionId: q.id,
        questionText: q.text || `Question ${q.id}`,
        responseDistribution: Object.entries(dist).map(([option, count]) => ({
          option,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        })),
      };
    });

    res.json({
      success: true,
      data: {
        surveyId,
        title: survey.title || '',
        totalResponses,
        completionRate: Math.round(completionRate * 10) / 10,
        averageTime: avgTime,
        responsesByDay,
        questionStats,
      },
    });
  } catch (error) {
    console.error('Error fetching survey analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching analytics' });
  }
});

// ── Survey Auto-Payout Helpers ──

// Detect MoMo provider from Ugandan phone number
// Handles: 07xxxxxxxx, 256xxxxxxxx, +256xxxxxxxx
function detectMoMoProvider(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Normalize to local 10-digit format (0xxxxxxxxx)
  let local = cleaned;
  if (local.startsWith('256') && local.length >= 12) {
    local = '0' + local.slice(3);
  }
  // Must be a valid 10-digit Ugandan number
  if (local.length !== 10 || !local.startsWith('0')) return null;
  // MTN Uganda: 077x, 078x, 076x
  if (/^07[678]/.test(local)) return 'MTN';
  // Airtel Uganda: 075x, 070x
  if (/^07[05]/.test(local)) return 'AIRTEL';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DORMANT BY DESIGN — survey MoMo payouts are intentionally NOT wired up.
//
// processSurveyPayout / rollbackPayoutBudget are a complete disbursement
// pipeline (MTN/Airtel, retry + backoff, atomic budget rollback), but nothing
// calls them: Survey.totalBudget is a self-declared number with NO
// funding/escrow flow behind it, so activating payouts would disburse the
// PLATFORM's MoMo money against unfunded creator promises. Respondents are
// instead credited config-driven points at submission (and the client now
// promises exactly that — see the 2026-06-11 "reward honesty" changelog entry,
// which also documents the gated activation design: atomic budget spend at
// submission, PENDING persist, async payout, points fallback, stale-PENDING
// sweeper). Do not call these until an escrow/funding product decision exists.
// ─────────────────────────────────────────────────────────────────────────────

// Process survey respondent payout with retry + exponential backoff
const SURVEY_PAYOUT_MAX_RETRIES = 3;
const SURVEY_PAYOUT_BASE_DELAY_MS = 1000;

async function processSurveyPayout({ responseId, phone, provider, amount, userId, surveyId }, attempt = 1) {
  try {
    console.log(`Processing survey payout: response=${responseId}, amount=${amount}, provider=${provider} (attempt ${attempt}/${SURVEY_PAYOUT_MAX_RETRIES})`);

    let paymentResult = null;

    if (provider === 'MTN') {
      paymentResult = await processMtnPayment({
        amount,
        phoneNumber: phone,
        userId,
        reason: `Survey reward payout - Survey ${surveyId}`,
      });
    } else if (provider === 'AIRTEL') {
      paymentResult = await processAirtelPayment({
        amount,
        phoneNumber: phone,
        userId,
        reason: `Survey reward payout - Survey ${surveyId}`,
      });
    }

    if (paymentResult && paymentResult.success) {
      await prisma.surveyResponse.update({
        where: { id: responseId },
        data: {
          paymentStatus: 'SUCCESSFUL',
          paymentReference: paymentResult.reference,
          paidAt: new Date(),
        },
      });

      console.log(`Survey payout successful: response=${responseId}, ref=${paymentResult.reference}`);

      // SSE: Notify respondent of payout success
      publishEvent(userId, 'survey.payout.success', {
        surveyId,
        amount,
        provider,
        reference: paymentResult.reference,
      }).catch(() => {});

      return { status: 'SUCCESSFUL', reference: paymentResult.reference };
    } else {
      // Retry with exponential backoff
      if (attempt < SURVEY_PAYOUT_MAX_RETRIES) {
        const delay = SURVEY_PAYOUT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Survey payout attempt ${attempt} failed for response=${responseId}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return processSurveyPayout({ responseId, phone, provider, amount, userId, surveyId }, attempt + 1);
      }

      // All retries exhausted — atomic rollback: mark FAILED + release budget
      await rollbackPayoutBudget(responseId, surveyId, amount);

      console.log(`Survey payout failed after ${SURVEY_PAYOUT_MAX_RETRIES} attempts: response=${responseId}`);

      publishEvent(userId, 'survey.payout.failed', { surveyId, amount, provider }).catch(() => {});

      return { status: 'FAILED', reference: null };
    }
  } catch (error) {
    console.error(`Survey payout error (attempt ${attempt}): response=${responseId}`, error);

    if (attempt < SURVEY_PAYOUT_MAX_RETRIES) {
      const delay = SURVEY_PAYOUT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      return processSurveyPayout({ responseId, phone, provider, amount, userId, surveyId }, attempt + 1);
    }

    // Atomic rollback: mark FAILED + release budget in single transaction
    await rollbackPayoutBudget(responseId, surveyId, amount);

    publishEvent(userId, 'survey.payout.failed', { surveyId, amount, provider }).catch(() => {});

    return { status: 'FAILED', reference: null };
  }
}

// Atomic rollback: mark response FAILED + decrement budget in one transaction
async function rollbackPayoutBudget(responseId, surveyId, amount) {
  try {
    await prisma.$transaction([
      prisma.surveyResponse.update({
        where: { id: responseId },
        data: { paymentStatus: 'FAILED' },
      }),
      prisma.survey.update({
        where: { id: surveyId },
        data: { amountDisbursed: { decrement: amount } },
      }),
    ]);
  } catch (rollbackError) {
    console.error(`Payout rollback failed: response=${responseId}`, rollbackError);
  }
}

// Get payout summary for a survey (owner only)
export const getSurveyPayoutSummary = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { userId: true, totalBudget: true, amountDisbursed: true, rewardAmount: true },
  });

  if (!survey) {
    return res.status(404).json({ success: false, message: 'Survey not found' });
  }

  if (survey.userId !== userId) {
    return res.status(403).json({ success: false, message: 'Only the survey owner can view payout summary' });
  }

  const [totalResponses, paidResponses, failedPayouts, pendingPayouts] = await Promise.all([
    prisma.surveyResponse.count({ where: { surveyId } }),
    prisma.surveyResponse.count({ where: { surveyId, paymentStatus: 'SUCCESSFUL' } }),
    prisma.surveyResponse.count({ where: { surveyId, paymentStatus: 'FAILED' } }),
    prisma.surveyResponse.count({ where: { surveyId, paymentStatus: 'PENDING' } }),
  ]);

  res.json({
    success: true,
    data: {
      totalBudget: survey.totalBudget,
      amountDisbursed: survey.amountDisbursed,
      rewardPerResponse: survey.rewardAmount,
      totalResponses,
      paidResponses,
      failedPayouts,
      pendingPayouts,
      budgetRemaining: survey.totalBudget ? survey.totalBudget - survey.amountDisbursed : null,
    },
  });
});