import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { ObjectId } from 'mongodb';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';

// Create a Survey
export const createSurvey = asyncHandler(async (req, res) => {
  const { surveyTitle, surveyDescription, questions, userId, startDate, endDate } = req.body;

  // Log the incoming request
  console.log('Incoming request: POST /surveys/create');
  console.log('Survey Title:', surveyTitle);
  console.log('Survey Description:', surveyDescription);
  console.log('Questions:', JSON.stringify(questions, null, 2));
  console.log('User ID:', userId);

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
  const { title, description, questions, userId ,startDate, endDate} = req.body;

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
  const { title, description, startDate, endDate, questions } = req.body;

  console.log('Updating survey:', surveyId);

  try {
    // Update the survey
    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        title,
        description,
        startDate: new Date(startDate), // Ensure startDate is a Date object
        endDate: new Date(endDate), // Ensure endDate is a Date object
      },
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
  const { userId, responses } = req.body;

  console.log('Submitting survey response for survey:', surveyId);
  console.log('User ID:', userId);
  console.log('Responses:', JSON.stringify(responses, null, 2));

  try {
    // Debug: Check if prisma is initialized
    if (!prisma) {
      console.error('Prisma client is not initialized');
      throw new Error('Database connection error');
    }

    // Debug: Check if surveyResponse exists
    if (!prisma.surveyResponse) {
      console.error('prisma.surveyResponse is undefined. Available models:', Object.keys(prisma));
      throw new Error('Database model error');
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
        message: 'You have already completed this survey. Only one attempt is allowed per user.',
        alreadyAttempted: true,
        attemptedAt: existingResponse.createdAt,
      });
    }

    // Save the responses
    const response = await prisma.surveyResponse.create({
      data: {
        userId,
        surveyId,
        responses: JSON.stringify(responses),
      },
    });

    console.log('Survey response submitted successfully:', response);
    res.status(201).json({ message: 'Survey response submitted successfully', response });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    res.status(500).json({ 
      message: 'Error submitting survey response', 
      error: error.message,
      stack: error.stack // Include stack trace for debugging
    });
  }
});

// Get Survey Responses
export const getSurveyResponses = asyncHandler(async (req, res) => {
  const { surveyId } = req.params;

  console.log('Fetching responses for survey:', surveyId);

  try {
    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId },
      // Prisma Accelerate: Short cache for responses (30s TTL, 10s SWR)
    });

    console.log('Responses fetched successfully:', responses);
    res.status(200).json(responses);
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
  } else {
    console.error(`Invalid status provided: ${status}`);
    return res.status(400).json({ message: 'Invalid status. Use "running" or "upcoming".' });
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