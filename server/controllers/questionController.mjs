import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';

// Create a Question
export const createQuestion = asyncHandler(async (req, res) => {
  const { text, userId } = req.body;

  console.log('Incoming request to create question:', { text, userId });

  if (!userId) {
    console.error('User ID is missing in the request.');
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Check if the user exists
    console.log('Checking if user exists:', userId);
    const userExists = await prisma.appUser.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      console.error('User not found:', userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log('User found:', userExists);

    // Create the question with explicit relation
    console.log('Creating question with text:', text);
    const question = await prisma.question.create({
      data: {
        text,
        user: {
          connect: { id: userId }, // Explicitly connect the user
        },
      },
    });

    console.log('Question created successfully:', question);
    res.status(201).json({ message: 'Question created successfully', question });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ message: 'Error creating question', error: error.message });
  }
});



// Get All Questions
// Get Most Recent 10 Questions
export const getQuestions = asyncHandler(async (_req, res) => {
  try {
    const questions = await prisma.question.findMany(
      buildOptimizedQuery('Question', {
        select: {
          id: true,
          text: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          responses: true,
          attempts: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              points: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 10, // preserve existing UX limit
      }),
    );

    const formattedQuestions = questions.map((q) => ({
      ...q,
      // Frontend expects these computed fields even though they are not persisted
      totalAnswers: q.responses?.length || 0,
      rewardAmount: q.rewardAmount || 0,
      isInstantReward: q.isInstantReward || false,
      category: q.category || 'General',
      user: q.user
        ? {
            ...q.user,
            avatar: q.user.avatar,
            points: q.user.points,
          }
        : null,
    }));

    res.json({
      success: true,
      data: formattedQuestions,
      pagination: {
        page: 1,
        limit: formattedQuestions.length,
        total: formattedQuestions.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    // Log any errors that occur
    console.error('Error retrieving questions:', error);

    // Send an error response to the client
    res.status(500).json({ message: 'Failed to retrieve questions', error: error.message });
  }
});

// Get a Single Question by ID
export const getQuestionById = asyncHandler(async (req, res) => {
  const { questionId } = req.params;

  const question = await prisma.question.findUnique({
    where: {
      id: questionId,
    },
    include: {
      responses: true,
      user: {
        select: { id: true, firstName: true, lastName: true, avatar: true, points: true },
      },
    },
    // Prisma Accelerate: Short cache for individual questions
  });

  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }

  const formatted = {
    ...question,
    totalAnswers: question.responses?.length || 0,
    rewardAmount: question.rewardAmount || 0,
    isInstantReward: question.isInstantReward || false,
    category: question.category || 'General',
  };

  res.json({ success: true, data: formatted });
});

// Create a Response for a Question
export const createResponse = asyncHandler(async (req, res) => {
  // Log the incoming request body and params
  console.log('Request Body:', req.body);
  console.log('Request Params:', req.params);

  // Extract questionId from the URL parameters
  const { questionId } = req.params;

  // Extract responseText and userId from the request body
  let { responseText, userId } = req.body;

  // Fallback to any existing user for mock/demo flows
  if (!userId) {
    const fallbackUser = await prisma.appUser.findFirst({ select: { id: true } });
    userId = fallbackUser?.id;
  }

  try {
    // Log the data being used to create the response
    console.log('Creating response with:', { questionId, responseText, userId });

    // Create the response in the database
    const response = await prisma.response.create({
      data: {
        questionId, // Use questionId from the URL
        responseText,
        userId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    // Log the successfully created response
    console.log('Response created successfully:', response);

    // Send a success response to the client
    res.status(201).json({
      success: true,
      message: 'Response created successfully',
      response: {
        ...response,
        createdAt: response.createdAt.toISOString(),
        updatedAt: response.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error creating response:', error);

    // Send an error response to the client
    res.status(500).json({ message: 'Failed to create response', error: error.message });
  }
});

// Get All Responses for a Question
export const getResponsesForQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const { userId, page = 1, limit = 20 } = req.query; // Optional userId to check user's like/dislike status

  try {
    // Fetch responses for the question, including user details and timestamps
    const skip = (Number(page) - 1) * Number(limit);
    const responses = await prisma.response.findMany(
      buildOptimizedQuery('Response', {
        where: { questionId },
        select: {
          id: true,
          responseText: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
        skip,
        take: Number(limit),
      }),
    );

    // Enhance responses with like/dislike/reply counts and user status
    const enhancedResponses = await Promise.all(
      responses.map(async (response) => {
        // Get counts
        const likeCount = await prisma.responseLike.count({
          where: { responseId: response.id },
        });

        const dislikeCount = await prisma.responseDislike.count({
          where: { responseId: response.id },
        });

        const replyCount = await prisma.responseReply.count({
          where: { responseId: response.id },
        });

        let isLiked = false;
        let isDisliked = false;

        // Check user's like/dislike status if userId is provided
        if (userId) {
          const userLike = await prisma.responseLike.findUnique({
            where: {
              userId_responseId: {
                userId,
                responseId: response.id,
              },
            },
          });

          const userDislike = await prisma.responseDislike.findUnique({
            where: {
              userId_responseId: {
                userId,
                responseId: response.id,
              },
            },
          });

          isLiked = !!userLike;
          isDisliked = !!userDislike;
        }

        return {
          ...response,
          likeCount,
          dislikeCount,
          replyCount,
          isLiked,
          isDisliked,
        };
      })
    );

    // Log the fetched responses for debugging
    console.log('Fetched enhanced responses:', enhancedResponses);

    // Send the enhanced responses as a JSON response
    const total = await prisma.response.count({ where: { questionId } });

    res.status(200).json({
      success: true,
      data: enhancedResponses.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error fetching responses:', error);

    // Send an error response to the client
    res.status(500).json({ message: 'Failed to fetch responses', error: error.message });
  }
});

export const uploadQuestions = asyncHandler(async (req, res) => {
  const { questions, userId } = req.body;

  // Log the incoming request
  console.log('Incoming request: POST /api/questions/loadquestions');
  console.log('Token:', req.headers.authorization);
  console.log('User ID:', userId);
  console.log('Questions:', JSON.stringify(questions, null, 2));

  // Check if the user exists
  const userExists = await prisma.appUser.findUnique({
    where: { id: userId },
  });

  if (!userExists) {
    console.error('User not found:', userId);
    return res.status(404).json({ message: 'User not found' });
  }

  try {
    // Format questions with userId
    const formattedQuestions = questions.map((q) => ({
      ...q,
      userId,
      options: q.options || [],
      correctAnswers: q.correctAnswers || [],
      placeholder: q.placeholder || '',
      minValue: q.minValue || null,
      maxValue: q.maxValue || null,
    }));

    // Log formatted questions
    console.log('Formatted Questions:', JSON.stringify(formattedQuestions, null, 2));

    // Use createMany for bulk insert (without skipDuplicates)
    const createdQuestions = await prisma.uploadQuestion.createMany({
      data: formattedQuestions,
    });

    // Fetch the newly created questions to return them in the response
    const uploadedQuestions = await prisma.uploadQuestion.findMany({
      where: {
        userId,
        text: { in: formattedQuestions.map((q) => q.text) },
      },
    });

    // Log successful upload
    console.log('Questions uploaded successfully. Count:', createdQuestions.count);

    // Return the array of uploaded questions
    res.status(201).json({
      message: 'Questions uploaded successfully.',
      count: createdQuestions.count,
      questions: uploadedQuestions, // Include the array of uploaded questions
    });
  } catch (error) {
    // Log the error
    console.error('Error uploading questions:', error);

    res.status(500).json({ message: 'Error uploading questions', error: error.message });
  }
});

// Get All Uploaded Questions
export const getUploadedQuestions = asyncHandler(async (_req, res) => {
  try {
    // Fetch all uploaded questions from the database
    const uploadedQuestions = await prisma.uploadQuestion.findMany(
      buildOptimizedQuery('UploadQuestion', {
        select: {
          id: true,
          text: true,
          type: true,
          options: true,
          correctAnswers: true,
          placeholder: true,
          createdAt: true,
          updatedAt: true,
          minValue: true,
          maxValue: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    );

    // Log the retrieved data
    console.log('Retrieved Uploaded Questions:', uploadedQuestions);

    // Send the uploaded questions as a JSON response
    res.status(200).json(uploadedQuestions);
  } catch (error) {
    // Log any errors that occur
    console.error('Error retrieving uploaded questions:', error);

    // Send an error response to the client
    res.status(500).json({ message: 'Failed to retrieve uploaded questions', error: error.message });
  }
});







export const AddRewardQuestion = asyncHandler(async (req, res) => {
  const { text, options, correctAnswer, userId } = req.body;

  const question = await prisma.rewardQuestion.create({
    data: {
      text,
      options,
      correctAnswer,
      userId, // Assuming you want to associate the question with a user
    },
  });

  res.status(201).json({ message: 'Question created successfully', question });
});


