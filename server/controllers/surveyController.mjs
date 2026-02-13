import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { ObjectId } from 'mongodb';
import { publishEvent } from '../lib/eventBus.mjs';

// Create a Survey
export const createSurvey = asyncHandler(async (req, res) => {
  const { surveyTitle, surveyDescription, questions, userId, startDate, endDate, rewardAmount, maxResponses } = req.body;

  // Log the incoming request
  console.log('Incoming request: POST /surveys/create');
  console.log('Survey Title:', surveyTitle);
  console.log('Survey Description:', surveyDescription);
  console.log('Questions:', JSON.stringify(questions, null, 2));
  console.log('User ID:', userId);
  console.log('Reward Amount:', rewardAmount);

  // Check if the user exists
  const userExists = await prisma.appUser.findUnique({
    where: { id: userId },
  });

  if (!userExists) {
    console.error('User not found:', userId);
    return res.status(404).json({ message: 'User not found' });
  }

  try {
    // Create the survey
    const newSurvey = await prisma.survey.create({
      data: {
        title: surveyTitle,
        description: surveyDescription,
        userId,
        rewardAmount: rewardAmount || 2000,
        maxResponses: maxResponses || null,
        startDate: new Date(startDate), // Ensure startDate is a Date object
        endDate: new Date(endDate), // Ensure endDate is a Date object
      },
    });

    // Format questions with userId and surveyId
    const formattedQuestions = questions.map((q) => ({
      text: q.question, // Map "question" field to "text"
      type: q.type,
      options: JSON.stringify(q.options || []), // Convert options array to JSON string
      placeholder: '', // Placeholder can be added if needed
      minValue: null, // Add if applicable
      maxValue: null, // Add if applicable
      userId,
      surveyId: newSurvey.id, // Associate questions with the survey
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

    res.status(500).json({ message: 'Error creating survey and questions', error: error.message });
  }
});


export const uploadSurvey = asyncHandler(async (req, res) => {
  const { title, description, questions, userId, startDate, endDate, rewardAmount, maxResponses } = req.body;

  // Log the incoming request
  console.log('Incoming request: POST /api/surveys/upload');
  console.log('Token:', req.headers.authorization);
  console.log('User ID:', userId);
  console.log('Title:', title);
  console.log('Description:', description);
  console.log('Questions:', JSON.stringify(questions, null, 2));

  // Validate userId format
  if (!ObjectId.isValid(userId)) {
    console.error('Invalid userId format:', userId);
    return res.status(400).json({ message: 'Invalid userId format' });
  }

  // Convert userId to ObjectID
  const userIdObjectId = new ObjectId(userId);

  // Check if the user exists
  const userExists = await prisma.appUser.findUnique({
    where: { id: userIdObjectId },
  });

  if (!userExists) {
    console.error('User not found:', userId);
    return res.status(404).json({ message: 'User not found' });
  }

  try {
    // Create the survey
    const newSurvey = await prisma.survey.create({
      data: {
        title,
        description,
        userId: userIdObjectId,
        rewardAmount: rewardAmount || 2000,
        maxResponses: maxResponses || null,
        startDate: new Date(startDate), // Ensure startDate is a Date object
        endDate: new Date(endDate), // Ensure endDate is a Date object
      },
    });

    // Format questions with userId and surveyId
    const formattedQuestions = questions.map((q) => ({
      text: q.text,
      type: q.type,
      options: JSON.stringify(q.options || []), // Convert options array to JSON string
      placeholder: q.placeholder || '',
      minValue: q.minValue || null,
      maxValue: q.maxValue || null,
      userId: userIdObjectId,
      surveyId: newSurvey.id, // Associate questions with the survey
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

    res.status(500).json({ message: 'Error uploading survey and questions', error: error.message });
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
    res.status(500).json({ message: 'Error fetching survey', error: error.message });
  }
});

// Update a Survey
export const updateSurvey = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { title, description, startDate, endDate, questions, rewardAmount, maxResponses } = req.body;

  console.log('Updating survey:', surveyId);

  try {
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
    res.status(500).json({ message: 'Error updating survey', error: error.message });
  }
});

// Delete a Survey
export const deleteSurvey = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;

  console.log('Deleting survey:', surveyId);

  try {
    // Delete the survey and its related questions
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
    res.status(500).json({ message: 'Error deleting survey', error: error.message });
  }
});

/**
 * Check if user has already attempted a survey
 * Industry standard: Single attempt per user per survey
 */
export const checkSurveyAttempt = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ 
      message: 'User ID is required',
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
      error: error.message,
      hasAttempted: false,
    });
  }
});

export const submitSurveyResponse = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { userId, responses, answers } = req.body;

  // Accept either "responses" or "answers" key for backward compatibility
  const responseData = responses || answers;

  console.log('Submitting survey response for survey:', surveyId);
  console.log('User ID:', userId);

  // Validate required fields
  if (!userId) {
    return res.status(400).json({
      success: false,
      submitted: false,
      message: 'User ID is required to submit a survey response.',
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

    // Check if survey is still within its valid date range
    const now = new Date();
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

    // Validate that all required questions have answers
    const requiredQuestions = (survey.uploads || []).filter(q => q.required !== false);
    const answeredIds = Object.keys(responseData);
    const missingRequired = requiredQuestions
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
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      submitted: true,
      message: 'Survey response submitted successfully!',
      reward,
      responseId: surveyResponse.id,
      submittedAt: surveyResponse.createdAt,
    });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    res.status(500).json({
      success: false,
      submitted: false,
      message: 'Error submitting survey response',
      error: error.message,
    });
  }
});

// Get Survey Responses (with pagination)
export const getSurveyResponses = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  try {
    const [responses, total] = await Promise.all([
      prisma.surveyResponse.findMany({
        where: { surveyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.surveyResponse.count({ where: { surveyId } }),
    ]);

    res.status(200).json({
      success: true,
      data: responses,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    res.status(500).json({ message: 'Error fetching survey responses', error: error.message });
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

  console.log('Where clause for query:', whereClause);

  try {
    console.log('Fetching surveys from the database...');
    const surveys = await prisma.survey.findMany({
      where: whereClause,
      include: {
        // Include related questions if needed
        uploads: true, // Include uploaded questions if needed
      },
      // Prisma Accelerate: Cache survey lists for 5 min, serve stale for 1 min
    });

    console.log(`Number of surveys found: ${surveys.length}`);
    res.json(surveys);
  } catch (error) {
    console.error('Error retrieving surveys:', error);
    res.status(500).json({ message: 'Error retrieving surveys', error: error.message });
  }
});

// Get All Surveys
export const getAllSurveys = asyncHandler(async (req, res) => {
  console.log('Request received to get all surveys');
  
  const { page = 1, limit = 20, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
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
          uploads: true,
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
        take: parseInt(limit),
      }),
      prisma.survey.count({ where: whereClause }),
    ]);

    console.log(`Surveys fetched: ${surveys.length} of ${total}`);
    
    res.json({
      success: true,
      data: surveys,
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
      error: error.message
    });
  }
});

// Get Survey Analytics
export const getSurveyAnalytics = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { uploads: true },
    });

    if (!survey) {
      return res.status(404).json({ success: false, message: 'Survey not found' });
    }

    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId },
      orderBy: { createdAt: 'desc' },
    });

    const totalResponses = responses.length;

    // Completion rate: responses / maxResponses (or 100% if no cap)
    const completionRate = survey.maxResponses
      ? Math.min((totalResponses / survey.maxResponses) * 100, 100)
      : 100;

    // Average completion time (estimated from response timestamps)
    const avgTime = totalResponses > 0
      ? (survey.uploads?.length || 1) * 30 // ~30s per question estimate
      : 0;

    // Responses grouped by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentResponses = responses.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);

    const dayMap = {};
    recentResponses.forEach(r => {
      const day = new Date(r.createdAt).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const responsesByDay = Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Per-question response distribution
    const questionStats = (survey.uploads || []).map(q => {
      const dist = {};
      responses.forEach(r => {
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
        questionText: q.question || q.title || `Question ${q.id}`,
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
        title: survey.surveyTitle || survey.title || '',
        totalResponses,
        completionRate: Math.round(completionRate * 10) / 10,
        averageTime: avgTime,
        responsesByDay,
        questionStats,
      },
    });
  } catch (error) {
    console.error('Error fetching survey analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching analytics', error: error.message });
  }
});