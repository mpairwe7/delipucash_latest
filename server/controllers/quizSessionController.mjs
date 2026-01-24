import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { processMtnPayment, processAirtelPayment } from './paymentController.mjs';

/**
 * Quiz Session Controller
 * Handles quiz questions, points management, and reward redemption
 */

// Points to UGX conversion rate
const POINTS_TO_UGX_RATE = 100; // 1 point = 100 UGX
const MIN_REDEMPTION_POINTS = 50;

/**
 * Get uploaded questions for quiz session
 * GET /api/uploadedQuestions
 */
export const getUploadedQuestions = asyncHandler(async (req, res) => {
  const { limit = 10, category } = req.query;

  try {
    const whereClause = category ? { category } : {};

    // Fetch uploaded questions
    const questions = await prisma.uploadedQuestion.findMany({
      where: whereClause,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        category: true,
        rewardAmount: true,
        createdAt: true,
      },
    });

    // Transform to quiz format
    const quizQuestions = questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      category: q.category || 'General',
      difficulty: 'medium',
      pointValue: q.rewardAmount || 10,
      timeLimit: 90,
      type: getQuestionType(q.options),
    }));

    res.json({ questions: quizQuestions });
  } catch (error) {
    console.error('Error fetching quiz questions:', error);
    res.status(500).json({ message: 'Failed to fetch questions' });
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
