import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { processMtnPayment, processAirtelPayment } from './paymentController.mjs';

/**
 * Quiz Session Controller
 * Handles quiz questions, points management, and reward redemption
 * 
 * Industry Standards:
 * - RESTful API design
 * - Proper error handling with meaningful messages
 * - Pagination support
 * - Mock data fallback for development
 */

// Points to UGX conversion rate
const POINTS_TO_UGX_RATE = 100; // 1 point = 100 UGX
const MIN_REDEMPTION_POINTS = 50;

// Mock questions for fallback when database is empty or unavailable
const MOCK_QUIZ_QUESTIONS = [
  {
    id: 'mock_001',
    text: 'What is the largest planet in our solar system?',
    options: { a: 'Earth', b: 'Mars', c: 'Jupiter', d: 'Saturn' },
    correctAnswer: 'c',
    explanation: 'Jupiter is the largest planet in our solar system.',
    category: 'Science',
    rewardAmount: 10,
  },
  {
    id: 'mock_002',
    text: 'Which programming language is known as the language of the web?',
    options: { a: 'Python', b: 'JavaScript', c: 'Java', d: 'C++' },
    correctAnswer: 'b',
    explanation: 'JavaScript is the primary programming language for web development.',
    category: 'Technology',
    rewardAmount: 10,
  },
  {
    id: 'mock_003',
    text: 'What is the capital city of Uganda?',
    options: { a: 'Nairobi', b: 'Kampala', c: 'Dar es Salaam', d: 'Kigali' },
    correctAnswer: 'b',
    explanation: 'Kampala is the capital and largest city of Uganda.',
    category: 'Geography',
    rewardAmount: 10,
  },
  {
    id: 'mock_004',
    text: 'Which company owns Instagram?',
    options: { a: 'Google', b: 'Microsoft', c: 'Meta (Facebook)', d: 'Twitter' },
    correctAnswer: 'c',
    explanation: 'Instagram was acquired by Facebook (now Meta) in 2012.',
    category: 'Technology',
    rewardAmount: 10,
  },
  {
    id: 'mock_005',
    text: 'What is the chemical symbol for Gold?',
    options: { a: 'Go', b: 'Gd', c: 'Au', d: 'Ag' },
    correctAnswer: 'c',
    explanation: 'The chemical symbol for Gold is Au, from the Latin word aurum.',
    category: 'Science',
    rewardAmount: 10,
  },
  {
    id: 'mock_006',
    text: 'How many continents are there on Earth?',
    options: { a: '5', b: '6', c: '7', d: '8' },
    correctAnswer: 'c',
    explanation: 'There are 7 continents: Africa, Antarctica, Asia, Australia, Europe, North America, and South America.',
    category: 'Geography',
    rewardAmount: 10,
  },
  {
    id: 'mock_007',
    text: 'What year did the first iPhone launch?',
    options: { a: '2005', b: '2006', c: '2007', d: '2008' },
    correctAnswer: 'c',
    explanation: 'The first iPhone was released on June 29, 2007.',
    category: 'Technology',
    rewardAmount: 15,
  },
  {
    id: 'mock_008',
    text: 'Which planet is known as the Red Planet?',
    options: { a: 'Venus', b: 'Mars', c: 'Jupiter', d: 'Mercury' },
    correctAnswer: 'b',
    explanation: 'Mars is called the Red Planet due to iron oxide on its surface.',
    category: 'Science',
    rewardAmount: 10,
  },
  {
    id: 'mock_009',
    text: 'What does HTTP stand for?',
    options: { a: 'HyperText Transfer Protocol', b: 'High Tech Transfer Protocol', c: 'Hyper Terminal Transfer Program', d: 'Home Tool Transfer Protocol' },
    correctAnswer: 'a',
    explanation: 'HTTP stands for HyperText Transfer Protocol.',
    category: 'Technology',
    rewardAmount: 15,
  },
  {
    id: 'mock_010',
    text: 'Which country has the largest population in Africa?',
    options: { a: 'Ethiopia', b: 'Egypt', c: 'South Africa', d: 'Nigeria' },
    correctAnswer: 'd',
    explanation: 'Nigeria has the largest population in Africa with over 200 million people.',
    category: 'Geography',
    rewardAmount: 15,
  },
];

/**
 * Get quiz questions for quiz session
 * Uses RewardQuestion model (non-instant reward questions) or falls back to mock data
 * 
 * GET /api/quiz/questions
 * Query params:
 *   - limit: number (default 10)
 *   - category: string (optional)
 *   - shuffle: boolean (default true)
 */
export const getUploadedQuestions = asyncHandler(async (req, res) => {
  const { limit = 10, category, shuffle = 'true' } = req.query;
  const shouldShuffle = shuffle === 'true';

  try {
    // Build query for non-instant reward questions (regular quiz questions)
    const whereClause = {
      isActive: true,
      isInstantReward: false, // Only get regular quiz questions, not instant reward
    };

    // Fetch questions from RewardQuestion model
    let questions = await prisma.rewardQuestion.findMany({
      where: whereClause,
      take: parseInt(limit) * 2, // Fetch more to allow for category filtering
      orderBy: shouldShuffle
        ? { createdAt: 'desc' }
        : { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        options: true,
        correctAnswer: true,
        rewardAmount: true,
        createdAt: true,
      },
    });

    // If no questions in database, use mock data
    if (!questions || questions.length === 0) {
      console.log('[QuizController] No questions in database, using mock data');
      questions = MOCK_QUIZ_QUESTIONS;
    }

    // Apply category filter if provided (for mock data compatibility)
    if (category) {
      questions = questions.filter(q =>
        (q.category || 'General').toLowerCase() === category.toLowerCase()
      );
    }

    // Shuffle if requested
    if (shouldShuffle) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    // Limit results
    questions = questions.slice(0, parseInt(limit));

    // Transform to quiz format
    const quizQuestions = questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      category: q.category || 'General',
      difficulty: q.difficulty || 'medium',
      pointValue: q.rewardAmount || 10,
      timeLimit: q.timeLimit || 90,
      type: getQuestionType(q.options),
    }));

    res.json({
      questions: quizQuestions,
      total: quizQuestions.length,
      source: questions === MOCK_QUIZ_QUESTIONS ? 'mock' : 'database',
    });
  } catch (error) {
    console.error('[QuizController] Error fetching quiz questions:', error);

    // Fallback to mock data on any error
    console.log('[QuizController] Falling back to mock data due to error');
    let mockQuestions = [...MOCK_QUIZ_QUESTIONS];

    if (category) {
      mockQuestions = mockQuestions.filter(q =>
        q.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (shouldShuffle) {
      mockQuestions = mockQuestions.sort(() => Math.random() - 0.5);
    }

    mockQuestions = mockQuestions.slice(0, parseInt(limit));

    const quizQuestions = mockQuestions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      category: q.category,
      difficulty: 'medium',
      pointValue: q.rewardAmount,
      timeLimit: 90,
      type: getQuestionType(q.options),
    }));

    res.json({
      questions: quizQuestions,
      total: quizQuestions.length,
      source: 'mock',
      fallback: true,
    });
  }
});

/**
 * Determine question type from options
 */
function getQuestionType(options) {
  if (!options) return 'text';
  
  const optionArray = Array.isArray(options) ? options : Object.values(options);
  
  if (optionArray.length === 2) {
    const normalized = optionArray.map(o => String(o).toLowerCase());
    if (
      (normalized.includes('true') && normalized.includes('false')) ||
      (normalized.includes('yes') && normalized.includes('no'))
    ) {
      return 'boolean';
    }
  }
  
  return 'single_choice';
}

/**
 * Get user's current points
 * GET /api/user/points/:userId
 */
export const getUserPoints = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        points: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate redeemed points from successful redemptions
    const redemptions = await prisma.reward.findMany({
      where: {
        userEmail: user.id, // This may need adjustment based on schema
        description: { contains: 'Redeemed' },
      },
      select: {
        points: true,
      },
    });

    const redeemedPoints = redemptions.reduce((sum, r) => sum + Math.abs(r.points), 0);
    const pendingRedemption = 0; // Could query pending transactions

    res.json({
      userId: user.id,
      totalPoints: user.points + redeemedPoints,
      availablePoints: user.points,
      redeemedPoints,
      pendingRedemption,
    });
  } catch (error) {
    console.error('Error fetching user points:', error);
    res.status(500).json({ message: 'Failed to fetch points' });
  }
});

/**
 * Update user's points after quiz session
 * PUT /api/user/points
 */
export const updateUserPoints = asyncHandler(async (req, res) => {
  const { userId, points, sessionId, source = 'quiz_session' } = req.body;

  if (!userId || points === undefined) {
    return res.status(400).json({ message: 'userId and points are required' });
  }

  try {
    // Update user points
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: {
        points: {
          increment: points,
        },
      },
      select: {
        id: true,
        points: true,
        email: true,
      },
    });

    // Create reward record for audit trail
    await prisma.reward.create({
      data: {
        userEmail: updatedUser.email,
        points,
        description: `Quiz session points: ${source} (${sessionId})`,
      },
    });

    res.json({
      userId: updatedUser.id,
      totalPoints: updatedUser.points,
      availablePoints: updatedUser.points,
      redeemedPoints: 0,
      pendingRedemption: 0,
    });
  } catch (error) {
    console.error('Error updating user points:', error);
    res.status(500).json({ message: 'Failed to update points' });
  }
});

/**
 * Save quiz session
 * POST /api/quiz-sessions
 */
export const saveQuizSession = asyncHandler(async (req, res) => {
  const {
    userId,
    questions,
    answers,
    totalPoints,
    correctCount,
    incorrectCount,
    maxStreak,
    startedAt,
    completedAt,
  } = req.body;

  try {
    // For now, we'll create a simplified session record
    // You may want to create a dedicated QuizSession model
    const sessionData = {
      id: `quiz_${Date.now()}`,
      userId,
      questions,
      answers,
      totalPoints,
      correctCount,
      incorrectCount,
      maxStreak,
      currentStreak: 0,
      averageTimePerQuestion: answers?.length > 0
        ? answers.reduce((sum, a) => sum + a.timeTaken, 0) / answers.length
        : 0,
      startedAt,
      completedAt,
    };

    // Update user points
    if (totalPoints > 0) {
      await prisma.appUser.update({
        where: { id: userId },
        data: {
          points: { increment: totalPoints },
        },
      });
    }

    res.json(sessionData);
  } catch (error) {
    console.error('Error saving quiz session:', error);
    res.status(500).json({ message: 'Failed to save session' });
  }
});

/**
 * Redeem points for cash or airtime
 * POST /api/rewards/redeem
 */
export const redeemReward = asyncHandler(async (req, res) => {
  const { userId, points, redemptionType, phoneNumber, provider } = req.body;

  if (!userId || !points || !phoneNumber || !provider) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (points < MIN_REDEMPTION_POINTS) {
    return res.status(400).json({ 
      message: `Minimum ${MIN_REDEMPTION_POINTS} points required for redemption` 
    });
  }

  try {
    // Check user has enough points
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, points: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.points < points) {
      return res.status(400).json({ 
        message: 'Insufficient points',
        available: user.points,
        requested: points,
      });
    }

    // Calculate cash value
    const cashValue = points * POINTS_TO_UGX_RATE;

    // Process disbursement based on provider
    let paymentResult;
    try {
      if (provider === 'MTN') {
        paymentResult = await processMtnPayment({
          amount: cashValue,
          phoneNumber,
          userId,
          reason: `Points redemption: ${points} points for ${redemptionType}`,
        });
      } else if (provider === 'AIRTEL') {
        paymentResult = await processAirtelPayment({
          amount: cashValue,
          phoneNumber,
          userId,
          reason: `Points redemption: ${points} points for ${redemptionType}`,
        });
      } else {
        return res.status(400).json({ message: 'Invalid provider. Use MTN or AIRTEL.' });
      }
    } catch (paymentError) {
      console.error('Payment processing error:', paymentError);
      return res.status(500).json({ 
        success: false,
        message: 'Payment processing failed. Please try again.',
        paymentStatus: 'FAILED',
      });
    }

    if (paymentResult && paymentResult.success) {
      // Deduct points from user
      const updatedUser = await prisma.appUser.update({
        where: { id: userId },
        data: {
          points: { decrement: points },
        },
        select: { points: true },
      });

      // Create negative reward record for audit
      await prisma.reward.create({
        data: {
          userEmail: user.email,
          points: -points,
          description: `Redeemed ${points} points for ${redemptionType}: ${cashValue} UGX via ${provider}`,
        },
      });

      res.json({
        success: true,
        transactionId: paymentResult.reference,
        amountRedeemed: cashValue,
        pointsDeducted: points,
        remainingPoints: updatedUser.points,
        message: `Successfully redeemed ${points} points for UGX ${cashValue.toLocaleString()}`,
        paymentStatus: 'SUCCESSFUL',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Payment failed. Please try again.',
        paymentStatus: 'FAILED',
      });
    }
  } catch (error) {
    console.error('Error redeeming reward:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process redemption',
      paymentStatus: 'FAILED',
    });
  }
});

/**
 * Initiate disbursement for rewards
 * POST /api/payments/disburse
 */
export const initiateDisbursement = asyncHandler(async (req, res) => {
  const { userId, amount, phoneNumber, provider, reason } = req.body;

  if (!userId || !amount || !phoneNumber || !provider) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    let paymentResult;

    if (provider === 'MTN') {
      paymentResult = await processMtnPayment({
        amount,
        phoneNumber,
        userId,
        reason: reason || 'Reward disbursement',
      });
    } else if (provider === 'AIRTEL') {
      paymentResult = await processAirtelPayment({
        amount,
        phoneNumber,
        userId,
        reason: reason || 'Reward disbursement',
      });
    } else {
      return res.status(400).json({ message: 'Invalid provider' });
    }

    if (paymentResult && paymentResult.success) {
      res.json({
        success: true,
        reference: paymentResult.reference,
        status: 'SUCCESSFUL',
      });
    } else {
      res.json({
        success: false,
        reference: null,
        status: 'FAILED',
      });
    }
  } catch (error) {
    console.error('Error initiating disbursement:', error);
    res.status(500).json({
      success: false,
      reference: null,
      status: 'FAILED',
      message: error.message,
    });
  }
});
