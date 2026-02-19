import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { publishEvent } from '../lib/eventBus.mjs';
import { dispatchWebhooks } from '../lib/webhookDispatcher.mjs';
import { processMtnPayment, processAirtelPayment } from './paymentController.mjs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Create a Survey
export const createSurvey = asyncHandler(async (req, res) => {
  const { surveyTitle, surveyDescription, questions, startDate, endDate, rewardAmount, maxResponses, totalBudget } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Log the incoming request
  console.log('Incoming request: POST /surveys/create');
  console.log('Survey Title:', surveyTitle);
  console.log('Survey Description:', surveyDescription);
  console.log('Questions:', JSON.stringify(questions, null, 2));
  console.log('User ID:', userId);
  console.log('Reward Amount:', rewardAmount);
  console.log('Total Budget:', totalBudget);

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: 'Invalid date format for startDate or endDate' });
  }
  if (end <= start) {
    return res.status(400).json({ message: 'End date must be after start date' });
  }

  // Validate question types
  const VALID_QUESTION_TYPES = ['text', 'textarea', 'multiple_choice', 'checkbox', 'rating', 'nps', 'slider', 'dropdown', 'date', 'time', 'file_upload'];

  const invalidQuestions = questions.filter(q => !VALID_QUESTION_TYPES.includes(q.type));
  if (invalidQuestions.length > 0) {
    return res.status(400).json({
      message: `Invalid question type(s): ${invalidQuestions.map(q => q.type).join(', ')}`,
      validTypes: VALID_QUESTION_TYPES,
    });
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
    // Create the survey
    const newSurvey = await prisma.survey.create({
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

    // Format questions with userId and surveyId
    const formattedQuestions = questions.map((q) => ({
      text: q.question,
      type: q.type,
      options: JSON.stringify(q.options || []),
      placeholder: q.placeholder || '',
      minValue: q.minValue || null,
      maxValue: q.maxValue || null,
      required: q.required ?? true,
      userId,
      surveyId: newSurvey.id,
    }));

    // Log formatted questions
    console.log('Formatted Questions:', JSON.stringify(formattedQuestions, null, 2));

    // Use createMany for bulk insert
    const createdQuestions = await prisma.uploadSurvey.createMany({
      data: formattedQuestions,
    });

    // Fetch the newly created questions to return them in the response
    const uploadedQuestions = await prisma.uploadSurvey.findMany({
      where: {
        surveyId: newSurvey.id,
      },
    });

    // Log successful creation
    console.log('Survey and questions created successfully.');

    // Return the survey and uploaded questions
    res.status(201).json({
      message: 'Survey and questions created successfully.',
      questions: uploadedQuestions,
    });
  } catch (error) {
    // Log the error
    console.error('Error creating survey and questions:', error);

    res.status(500).json({ message: 'Error creating survey and questions' });
  }
});


export const uploadSurvey = asyncHandler(async (req, res) => {
  const { title, description, questions, startDate, endDate, rewardAmount, maxResponses, totalBudget } = req.body;
  const userId = req.user?.id;

  // Log the incoming request (no sensitive data)
  console.log('Incoming request: POST /api/surveys/upload, userId:', userId);

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
  }

  try {
    // Create the survey
    const newSurvey = await prisma.survey.create({
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

    // Format questions with userId and surveyId (including optional conditionalLogic)
    const formattedQuestions = questions.map((q) => ({
      text: q.text,
      type: q.type,
      options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
      placeholder: q.placeholder || '',
      minValue: q.minValue || null,
      maxValue: q.maxValue || null,
      required: q.required ?? true,
      conditionalLogic: q.conditionalLogic || null,
      userId,
      surveyId: newSurvey.id,
    }));

    // Log formatted questions
    console.log('Formatted Questions:', JSON.stringify(formattedQuestions, null, 2));

    // Use createMany for bulk insert
    const createdQuestions = await prisma.uploadSurvey.createMany({
      data: formattedQuestions,
    });

    // Fetch the newly created questions to return them in the response
    const uploadedQuestions = await prisma.uploadSurvey.findMany({
      where: {
        surveyId: newSurvey.id,
      },
    });

    // Log successful upload
    console.log('Survey and questions uploaded successfully.');

    // Return the survey and uploaded questions
    res.status(201).json({
      message: 'Survey and questions uploaded successfully.',
      questions: uploadedQuestions,

    });
  } catch (error) {
    // Log the error
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
      select: { userId: true },
    });

    if (!existingSurvey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    if (existingSurvey.userId !== userId) {
      return res.status(403).json({ message: 'Access denied. You do not own this survey.' });
    }

    // Validate dates if provided
    if (startDate !== undefined && endDate !== undefined) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      if (end <= start) {
        return res.status(400).json({ message: 'End date must be after start date' });
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

    // Update the survey
    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: updateData,
    });

    // Update or create questions
    if (questions && questions.length > 0) {
      await Promise.all(
        questions.map(async (q) => {
          if (q.id) {
            // Update existing question
            await prisma.uploadSurvey.update({
              where: { id: q.id },
              data: {
                text: q.text,
                type: q.type,
                options: JSON.stringify(q.options || []),
                placeholder: q.placeholder || '',
                minValue: q.minValue || null,
                maxValue: q.maxValue || null,
                required: q.required ?? true,
              },
            });
          } else {
            // Create new question
            await prisma.uploadSurvey.create({
              data: {
                text: q.text,
                type: q.type,
                options: JSON.stringify(q.options || []),
                placeholder: q.placeholder || '',
                minValue: q.minValue || null,
                maxValue: q.maxValue || null,
                required: q.required ?? true,
                userId: updatedSurvey.userId,
                surveyId: updatedSurvey.id,
              },
            });
          }
        })
      );
    }

    console.log('Survey updated successfully:', updatedSurvey);
    res.status(200).json({ message: 'Survey updated successfully', survey: updatedSurvey });
  } catch (error) {
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

    // Clean up R2 file uploads before deleting survey
    const fileUploads = await prisma.surveyFileUpload.findMany({
      where: { surveyId },
      select: { r2Key: true },
    });

    if (fileUploads.length > 0) {
      const { deleteFile } = await import('../lib/r2.mjs');
      await Promise.allSettled(
        fileUploads.map(f => deleteFile(f.r2Key).catch(() => {}))
      );
    }

    // Delete the survey and its related questions (cascades handle the rest)
    await prisma.uploadSurvey.deleteMany({
      where: { surveyId },
    });

    await prisma.survey.delete({
      where: { id: surveyId },
    });

    console.log('Survey deleted successfully:', surveyId);
    res.status(200).json({ message: 'Survey deleted successfully' });
  } catch (error) {
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

    // Save the responses
    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        userId,
        surveyId,
        responses: JSON.stringify(responseData),
        completedAt: new Date(),
      },
    });

    // Calculate reward (from survey's rewardAmount field)
    const reward = survey.rewardAmount || 0;

    // Award reward points to user if applicable
    if (reward > 0) {
      try {
        await prisma.appUser.update({
          where: { id: userId },
          data: {
            points: { increment: reward },
          },
        });
        console.log(`Awarded ${reward} points to user ${userId}`);
      } catch (rewardError) {
        console.error('Error awarding reward points:', rewardError);
        // Don't fail the submission if reward fails
      }
    }

    // Auto-payout: disburse mobile money if survey has a budget
    let payoutInitiated = false;
    if (reward > 0 && survey.totalBudget && survey.amountDisbursed + reward <= survey.totalBudget) {
      try {
        // Fetch respondent's phone info
        const respondent = await prisma.appUser.findUnique({
          where: { id: userId },
          select: { phone: true },
        });

        // Determine provider from phone prefix (Uganda: 077/078=MTN, 075/070=AIRTEL)
        const phone = respondent?.phone?.replace(/\s+/g, '');
        const provider = phone ? detectMoMoProvider(phone) : null;

        if (phone && provider) {
          // Atomically increment amountDisbursed + mark response as PENDING
          await prisma.$transaction([
            prisma.survey.update({
              where: { id: surveyId },
              data: { amountDisbursed: { increment: reward } },
            }),
            prisma.surveyResponse.update({
              where: { id: surveyResponse.id },
              data: {
                amountAwarded: reward,
                paymentStatus: 'PENDING',
                paymentProvider: provider,
                phoneNumber: phone,
              },
            }),
          ]);

          payoutInitiated = true;

          // Fire-and-forget: process actual disbursement (non-blocking)
          processSurveyPayout({
            responseId: surveyResponse.id,
            phone,
            provider,
            amount: reward,
            userId,
            surveyId,
          }).catch((err) => console.error('Survey payout error (fire-and-forget):', err));
        }
      } catch (payoutError) {
        console.error('Error initiating survey auto-payout:', payoutError);
        // Don't fail the submission — points were already awarded
      }
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
    if (reward > 0) {
      publishEvent(userId, 'survey.completed', {
        surveyId,
        reward,
        payoutInitiated,
      }).catch(() => {});
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
      message: payoutInitiated
        ? 'Survey response submitted! Your mobile money payment is being processed.'
        : 'Survey response submitted successfully!',
      reward,
      payoutInitiated,
      responseId: surveyResponse.id,
      submittedAt: surveyResponse.createdAt,
    });
  } catch (error) {
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
    res.json({
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
    });
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

    res.json({
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
    });
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

    // Responses grouped by day (last 30 days) — use DB groupBy
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyGroups = await prisma.surveyResponse.groupBy({
      by: ['createdAt'],
      where: { surveyId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    });
    // Aggregate by date string
    const dayMap = {};
    dailyGroups.forEach(g => {
      const day = new Date(g.createdAt).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + g._count;
    });
    const responsesByDay = Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

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
function detectMoMoProvider(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Normalize to local format
  const local = cleaned.startsWith('256') ? '0' + cleaned.slice(3) : cleaned;
  // MTN Uganda: 077x, 078x, 076x
  if (/^07[678]/.test(local)) return 'MTN';
  // Airtel Uganda: 075x, 070x
  if (/^07[05]/.test(local)) return 'AIRTEL';
  return null;
}

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

      // All retries exhausted
      await prisma.surveyResponse.update({
        where: { id: responseId },
        data: { paymentStatus: 'FAILED' },
      });

      // Rollback the disbursed amount since payment failed
      await prisma.survey.update({
        where: { id: surveyId },
        data: { amountDisbursed: { decrement: amount } },
      });

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

    await prisma.surveyResponse.update({
      where: { id: responseId },
      data: { paymentStatus: 'FAILED' },
    });

    await prisma.survey.update({
      where: { id: surveyId },
      data: { amountDisbursed: { decrement: amount } },
    });

    publishEvent(userId, 'survey.payout.failed', { surveyId, amount, provider }).catch(() => {});

    return { status: 'FAILED', reference: null };
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