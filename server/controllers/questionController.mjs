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



// Get All Questions (with pagination)
export const getQuestions = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      prisma.question.findMany(
        buildOptimizedQuery('Question', {
          select: {
            id: true,
            text: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { responses: true } },
            rewardAmount: true,
            isInstantReward: true,
            category: true,
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
          skip,
          take: limit,
        }),
      ),
      prisma.question.count(),
    ]);

    const formattedQuestions = questions.map((q) => ({
      ...q,
      totalAnswers: q._count?.responses || 0,
      rewardAmount: q.rewardAmount || 0,
      isInstantReward: q.isInstantReward || false,
      category: q.category || 'General',
      _count: undefined,
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
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error retrieving questions:', error);
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
    // Fetch responses with counts in a single query (avoids N+1)
    const skip = (Number(page) - 1) * Number(limit);

    // Build include clause conditionally based on whether userId is provided
    const likesInclude = userId
      ? { where: { userId: String(userId) }, select: { id: true } }
      : false;
    const dislikesInclude = userId
      ? { where: { userId: String(userId) }, select: { id: true } }
      : false;

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
          _count: {
            select: {
              likes: true,
              dislikes: true,
              replies: true,
            },
          },
          ...(likesInclude && { likes: likesInclude }),
          ...(dislikesInclude && { dislikes: dislikesInclude }),
        },
        orderBy: [{ createdAt: 'asc' }],
        skip,
        take: Number(limit),
      }),
    );

    // Map to expected format using aggregated counts (no extra queries)
    const enhancedResponses = responses.map((response) => ({
      ...response,
      likeCount: response._count?.likes || 0,
      dislikeCount: response._count?.dislikes || 0,
      replyCount: response._count?.replies || 0,
      isLiked: userId ? (response.likes?.length || 0) > 0 : false,
      isDisliked: userId ? (response.dislikes?.length || 0) > 0 : false,
      _count: undefined,
      likes: undefined,
      dislikes: undefined,
    }));

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







// Vote on a question (upvote / downvote toggle)
export const voteQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const { type, userId } = req.body; // type: 'up' | 'down'

  if (!type || !['up', 'down'].includes(type)) {
    return res.status(400).json({ message: 'Invalid vote type. Must be "up" or "down".' });
  }

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    // Check for existing vote by this user on this question
    const existingVote = await prisma.questionVote.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });

    if (existingVote) {
      if (existingVote.type === type) {
        // Toggle off: user clicks same vote type again
        await prisma.questionVote.delete({
          where: { id: existingVote.id },
        });
      } else {
        // Switch vote type
        await prisma.questionVote.update({
          where: { id: existingVote.id },
          data: { type },
        });
      }
    } else {
      // New vote
      await prisma.questionVote.create({
        data: { userId, questionId, type },
      });
    }

    // Return current counts
    const [upvotes, downvotes] = await Promise.all([
      prisma.questionVote.count({ where: { questionId, type: 'up' } }),
      prisma.questionVote.count({ where: { questionId, type: 'down' } }),
    ]);

    res.json({ success: true, upvotes, downvotes });
  } catch (error) {
    console.error('Error voting on question:', error);
    res.status(500).json({ message: 'Failed to vote', error: error.message });
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


