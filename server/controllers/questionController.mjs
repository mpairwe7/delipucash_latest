import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';

// ============================================================================
// Resilient Question Select — gracefully handles missing schema fields
// ============================================================================

/**
 * Base select fields that exist in the original schema.
 * Extended fields (category, rewardAmount, isInstantReward, viewCount)
 * are merged in so that both old and new deployments work.
 */
const QUESTION_BASE_SELECT = {
  id: true,
  text: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { responses: true, votes: true } },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
      points: true,
    },
  },
};

const QUESTION_EXTENDED_SELECT = {
  ...QUESTION_BASE_SELECT,
  category: true,
  rewardAmount: true,
  isInstantReward: true,
  viewCount: true,
};

/**
 * Format a raw Prisma question row into a consistent API shape.
 * Falls back safely when optional fields are absent.
 */
function formatQuestion(q) {
  return {
    id: q.id,
    text: q.text,
    userId: q.userId,
    category: q.category ?? 'General',
    rewardAmount: q.rewardAmount ?? 0,
    isInstantReward: q.isInstantReward ?? false,
    viewCount: q.viewCount ?? 0,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    totalAnswers: q._count?.responses ?? 0,
    totalVotes: q._count?.votes ?? 0,
    upvotes: q._upvotes ?? 0,
    downvotes: q._downvotes ?? 0,
    user: q.user
      ? {
          id: q.user.id,
          firstName: q.user.firstName,
          lastName: q.user.lastName,
          avatar: q.user.avatar,
          points: q.user.points,
        }
      : null,
  };
}

/**
 * Attempt query with extended fields, automatically retry with base fields
 * if extended columns don't exist yet (handles migration lag on deploy).
 */
async function resilientQuestionFindMany(queryOptions) {
  try {
    return await prisma.question.findMany(queryOptions);
  } catch (err) {
    if (err?.message?.includes('Unknown field')) {
      // Fallback: remove extended fields and retry
      const fallback = { ...queryOptions, select: QUESTION_BASE_SELECT };
      return await prisma.question.findMany(fallback);
    }
    throw err;
  }
}

// Create a Question
export const createQuestion = asyncHandler(async (req, res) => {
  const {
    text,
    userId,
    category = 'General',
    rewardAmount = 0,
    isInstantReward = false,
  } = req.body;

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
        category: category || 'General',
        rewardAmount: Number.isFinite(Number(rewardAmount))
          ? Number(rewardAmount)
          : 0,
        isInstantReward: Boolean(isInstantReward),
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



// Get All Questions (with pagination, vote counts, and feed stats)
export const getQuestions = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const tab = req.query.tab || 'for-you';

    // Build where clause based on tab
    let whereClause = {};
    if (tab === 'unanswered') {
      whereClause = { responses: { none: {} } };
    } else if (tab === 'rewards') {
      whereClause = { isInstantReward: true, rewardAmount: { gt: 0 } };
    }

    // Build order based on tab
    let orderBy = [{ createdAt: 'desc' }];
    if (tab === 'latest') {
      orderBy = [{ createdAt: 'desc' }];
    }

    const queryOptions = buildOptimizedQuery('Question', {
      select: QUESTION_EXTENDED_SELECT,
      where: whereClause,
      orderBy,
      skip,
      take: limit,
    });

    const [questions, total, unansweredCount, rewardsCount] = await Promise.all([
      resilientQuestionFindMany(queryOptions),
      prisma.question.count({ where: whereClause }),
      prisma.question.count({ where: { responses: { none: {} } } }),
      prisma.question.count({ where: { isInstantReward: true, rewardAmount: { gt: 0 } } }),
    ]);

    // Batch fetch vote counts for all questions in one query
    const questionIds = questions.map(q => q.id);
    const voteCounts = questionIds.length > 0
      ? await prisma.questionVote.groupBy({
          by: ['questionId', 'type'],
          where: { questionId: { in: questionIds } },
          _count: { id: true },
        })
      : [];

    // Build vote count maps
    const upvoteMap = new Map();
    const downvoteMap = new Map();
    for (const vc of voteCounts) {
      if (vc.type === 'up') upvoteMap.set(vc.questionId, vc._count.id);
      else if (vc.type === 'down') downvoteMap.set(vc.questionId, vc._count.id);
    }

    const formattedQuestions = questions.map(q => {
      const formatted = formatQuestion(q);
      formatted.upvotes = upvoteMap.get(q.id) || 0;
      formatted.downvotes = downvoteMap.get(q.id) || 0;
      return formatted;
    });

    res.json({
      success: true,
      data: formattedQuestions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      stats: {
        totalQuestions: total,
        unansweredCount,
        rewardsCount,
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

  let question;
  try {
    question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        responses: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true, points: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true, points: true },
        },
      },
    });
  } catch (err) {
    console.error('Error fetching question by ID:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch question', error: err.message });
  }

  if (!question) {
    return res.status(404).json({ success: false, message: 'Question not found' });
  }

  const formatted = formatQuestion(question);
  // Include full responses in detail endpoint
  formatted.responses = question.responses || [];

  res.json({ success: true, data: formatted });
});

// Create a Response for a Question
export const createResponse = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  let { responseText, userId } = req.body;

  // Validate required fields
  if (!responseText || !responseText.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Response text is required',
    });
  }

  // Fallback to any existing user for mock/demo flows
  if (!userId) {
    const fallbackUser = await prisma.appUser.findFirst({ select: { id: true } });
    userId = fallbackUser?.id;
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
    });
  }

  try {
    // Check if the question exists and get reward info
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        rewardAmount: true,
        isInstantReward: true,
        userId: true,
      },
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    // Check for duplicate response by this user on this question
    const existingResponse = await prisma.response.findFirst({
      where: { questionId, userId },
    });

    if (existingResponse) {
      return res.status(409).json({
        success: false,
        message: 'You have already responded to this question',
      });
    }

    // Create the response in the database
    const response = await prisma.response.create({
      data: {
        questionId,
        responseText: responseText.trim(),
        userId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    // Calculate reward earned (distribute reward for answering)
    let rewardEarned = 0;
    const rewardAmount = question.rewardAmount ?? 0;

    if (rewardAmount > 0 && question.userId !== userId) {
      rewardEarned = rewardAmount;
      // Credit reward to user's points balance
      try {
        await prisma.appUser.update({
          where: { id: userId },
          data: { points: { increment: rewardEarned } },
        });
      } catch (pointsError) {
        // Log but don't fail the response creation
        console.error('Failed to credit reward points:', pointsError);
      }
    }

    console.log('Response created successfully:', {
      responseId: response.id,
      questionId,
      userId,
      rewardEarned,
    });

    res.status(201).json({
      success: true,
      message: 'Response created successfully',
      response: {
        ...response,
        createdAt: response.createdAt.toISOString(),
        updatedAt: response.updatedAt.toISOString(),
      },
      rewardEarned,
    });
  } catch (error) {
    console.error('Error creating response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create response',
      error: error.message,
    });
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

// ============================================================================
// Questions Leaderboard — top earners/answerers
// ============================================================================

/**
 * GET /api/questions/leaderboard?limit=10
 * Returns top users ranked by total answers + points.
 * Public endpoint — no auth required.
 */
export const getLeaderboard = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const userId = req.query.userId || null;

  try {
    // Get top users by points (points represent earnings/activity)
    const topUsers = await prisma.appUser.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        points: true,
        _count: {
          select: {
            Response: true,
            attempts: true,
          },
        },
      },
      orderBy: { points: 'desc' },
      take: limit,
    });

    const users = topUsers.map((u, index) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      avatar: u.avatar,
      points: u.points,
      rank: index + 1,
      answersCount: (u._count?.Response || 0) + (u._count?.attempts || 0),
    }));

    // Get current user rank if userId provided
    let currentUserRank = 0;
    if (userId) {
      const currentUser = await prisma.appUser.findUnique({
        where: { id: userId },
        select: { points: true },
      });
      if (currentUser) {
        currentUserRank = await prisma.appUser.count({
          where: { points: { gt: currentUser.points } },
        }) + 1;
      }
    }

    const totalUsers = await prisma.appUser.count();

    res.json({
      success: true,
      data: {
        users,
        currentUserRank,
        totalUsers,
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard', error: error.message });
  }
});

// ============================================================================
// User Question Stats — real stats from database
// ============================================================================

/**
 * GET /api/questions/user-stats?userId=xxx
 * Returns real user stats: answers, earnings, streak, daily progress.
 * Falls back gracefully when tables are empty.
 */
export const getUserQuestionStats = asyncHandler(async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { points: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Calculate real stats in parallel
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalResponses,
      totalAttempts,
      todayResponses,
      todayAttempts,
      rewardSum,
      // Get responses from last 7 days for weekly progress
      weeklyResponses,
    ] = await Promise.all([
      // Total responses submitted
      prisma.response.count({ where: { userId } }),
      // Total quiz attempts
      prisma.questionAttempt.count({ where: { userEmail: user.email } }),
      // Today's responses
      prisma.response.count({
        where: { userId, createdAt: { gte: today } },
      }),
      // Today's quiz attempts
      prisma.questionAttempt.count({
        where: { userEmail: user.email, attemptedAt: { gte: today } },
      }),
      // Total reward earnings
      prisma.reward.aggregate({
        where: { userEmail: user.email },
        _sum: { points: true },
      }),
      // Weekly progress (last 7 days grouped by day)
      prisma.response.groupBy({
        by: ['createdAt'],
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        _count: { id: true },
      }),
    ]);

    // Build weekly progress array (last 7 days)
    const weeklyProgress = Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);

      return weeklyResponses
        .filter(r => {
          const d = new Date(r.createdAt);
          return d >= dayStart && d <= dayEnd;
        })
        .reduce((sum, r) => sum + r._count.id, 0);
    });

    // Calculate streak: count consecutive days with activity going backwards
    let currentStreak = 0;
    const questionsAnsweredToday = todayResponses + todayAttempts;
    if (questionsAnsweredToday > 0) currentStreak = 1;

    // Check previous days for streak
    for (let i = 1; i <= 30; i++) {
      const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayActivity = await prisma.response.count({
        where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
      });

      if (dayActivity > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    const totalAnswered = totalResponses + totalAttempts;
    const totalEarnings = (rewardSum._sum?.points || 0) + (user.points || 0);

    res.json({
      success: true,
      data: {
        totalAnswered,
        totalEarnings,
        currentStreak,
        questionsAnsweredToday,
        dailyTarget: 10,
        weeklyProgress,
      },
    });
  } catch (error) {
    console.error('Error fetching user question stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
});


