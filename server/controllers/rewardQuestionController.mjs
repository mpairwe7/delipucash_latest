import crypto from 'crypto';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';
import { publishEvent } from '../lib/eventBus.mjs';
import { getRewardConfig, ugxToPoints } from '../lib/rewardConfig.mjs';
import { createNotificationFromTemplateHelper } from './notificationController.mjs';
import { createPaymentLogger, maskPhone } from '../lib/paymentLogger.mjs';

const log = createPaymentLogger('instant-reward');

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual under the hood.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Compare against self to maintain constant timing, then return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Format a reward question for public API responses.
 * SECURITY: Never expose correctAnswer, phoneNumber, or full winner emails publicly.
 */
function formatRewardQuestionPublic(rq, { includeAnswer = false } = {}) {
  const formatted = {
    id: rq.id,
    text: rq.text,
    options: rq.options,
    rewardAmount: rq.rewardAmount,
    questionType: rq.questionType || 'multiple_choice',
    matchMode: rq.matchMode || 'case_insensitive',
    expiryTime: rq.expiryTime instanceof Date ? rq.expiryTime.toISOString() : (rq.expiryTime || null),
    isActive: rq.isActive,
    userId: rq.userId,
    isInstantReward: rq.isInstantReward,
    maxWinners: rq.maxWinners,
    winnersCount: rq.winnersCount,
    isCompleted: rq.isCompleted,
    createdAt: rq.createdAt instanceof Date ? rq.createdAt.getTime() : rq.createdAt,
    updatedAt: rq.updatedAt instanceof Date ? rq.updatedAt.getTime() : rq.updatedAt,
    user: rq.user ? {
      id: rq.user.id,
      firstName: rq.user.firstName || 'Anonymous',
      lastName: rq.user.lastName || '',
      avatar: rq.user.avatar,
    } : null,
  };

  if (includeAnswer) {
    formatted.correctAnswer = rq.correctAnswer;
  }

  if (rq.winners) {
    formatted.winners = rq.winners.map(w => ({
      id: w.id,
      userEmail: maskEmail(w.userEmail),
      position: w.position,
      amountAwarded: w.amountAwarded,
      paymentStatus: w.paymentStatus,
      createdAt: w.createdAt instanceof Date ? w.createdAt.getTime() : w.createdAt,
    }));
  }

  return formatted;
}

function maskEmail(email) {
  if (!email) return '***';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

/**
 * Safety-net deduplication by primary key.
 * Prisma findMany already returns unique rows, but offset/limit pagination
 * can theoretically deliver the same record across adjacent page boundaries
 * if data mutates between fetches. This guarantees uniqueness per response.
 */
function deduplicateById(records) {
  const seen = new Set();
  return records.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

// Create a new reward question
export const createRewardQuestion = asyncHandler(async (req, res) => {
  try {
    const {
      text,
      options,
      correctAnswer,
      rewardAmount,
      expiryTime,
      isInstantReward = false,
      maxWinners = 2,
      paymentProvider,
      phoneNumber,
      questionType = 'multiple_choice',
      matchMode: rawMatchMode = 'case_insensitive',
    } = req.body;

    // Token-bound identity: use authenticated user from JWT
    const userId = req.user?.id;

    // Validate questionType and matchMode enums
    const VALID_QUESTION_TYPES = ['multiple_choice', 'text_input'];
    const VALID_MATCH_MODES = ['exact', 'case_insensitive'];
    if (!VALID_QUESTION_TYPES.includes(questionType)) {
      return res.status(400).json({ message: "questionType must be 'multiple_choice' or 'text_input'" });
    }
    // matchMode only applies to text_input; force 'exact' for multiple_choice
    let matchMode;
    if (questionType === 'text_input') {
      if (!VALID_MATCH_MODES.includes(rawMatchMode)) {
        return res.status(400).json({ message: "matchMode must be 'exact' or 'case_insensitive'" });
      }
      matchMode = rawMatchMode;
    } else {
      matchMode = 'exact';
    }

    // Validate required fields (rewardAmount is optional — falls back to config default)
    if (!text || !correctAnswer || !userId) {
      return res.status(400).json({
        message: "Text and correctAnswer are required"
      });
    }

    // Resolve reward amount: use explicit value or fall back to config default
    let resolvedRewardAmount = rewardAmount;
    if (!resolvedRewardAmount || Number(resolvedRewardAmount) <= 0) {
      const config = await getRewardConfig();
      resolvedRewardAmount = isInstantReward
        ? config.defaultInstantRewardAmount
        : config.defaultRegularRewardAmount;
    }

    // Validate text is a non-empty string with max 2000 characters
    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ message: "Text must be a non-empty string" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ message: "Text must be at most 2000 characters" });
    }

    // Branch validation on questionType
    if (questionType === 'text_input') {
      // text_input: correctAnswer is pipe-delimited accepted answers
      if (typeof correctAnswer !== 'string' || correctAnswer.trim().length === 0) {
        return res.status(400).json({ message: "correctAnswer must be a non-empty string for text_input questions" });
      }
      const acceptedAnswers = correctAnswer.split('|').map(a => a.trim()).filter(a => a.length > 0);
      if (acceptedAnswers.length < 1 || acceptedAnswers.length > 20) {
        return res.status(400).json({ message: "text_input questions must have between 1 and 20 accepted answers (pipe-delimited)" });
      }
      // options is optional metadata for text_input (placeholder, hint, maxLength)
      if (options != null && typeof options !== 'object') {
        return res.status(400).json({ message: "Options for text_input must be an object or null" });
      }
    } else {
      // multiple_choice: existing validation
      if (!options) {
        return res.status(400).json({ message: "Options are required for multiple_choice questions" });
      }
      if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        return res.status(400).json({ message: "Options must be a non-null object" });
      }
      const optionKeys = Object.keys(options);
      if (optionKeys.length < 2 || optionKeys.length > 10) {
        return res.status(400).json({ message: "Options must have between 2 and 10 entries" });
      }

      // Validate option values are non-empty trimmed strings
      for (const key of optionKeys) {
        if (typeof options[key] !== 'string' || options[key].trim().length === 0) {
          return res.status(400).json({ message: `Option ${key} must be a non-empty string` });
        }
      }

      // Validate correctAnswer exists as a key in the options object
      if (!optionKeys.includes(correctAnswer)) {
        return res.status(400).json({ message: "correctAnswer must be one of the option keys" });
      }
    }

    // Coerce and validate reward amount bounds
    const parsedRewardAmount = Number(resolvedRewardAmount);
    if (isNaN(parsedRewardAmount) || parsedRewardAmount <= 0) {
      return res.status(400).json({
        message: "Reward amount must be greater than 0"
      });
    }
    if (parsedRewardAmount > 1000000) {
      return res.status(400).json({
        message: "Reward amount must not exceed 1,000,000"
      });
    }

    // Validate instant reward fields
    if (isInstantReward) {
      if (!paymentProvider || !phoneNumber) {
        return res.status(400).json({ 
          message: "Payment provider and phone number are required for instant reward questions" 
        });
      }
      if (!['MTN', 'AIRTEL'].includes(paymentProvider)) {
        return res.status(400).json({ 
          message: "Payment provider must be either MTN or AIRTEL" 
        });
      }
      if (maxWinners < 1 || maxWinners > 10) {
        return res.status(400).json({ 
          message: "Max winners must be between 1 and 10" 
        });
      }
    }

    // Ensure user exists
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Trim text and option values before storage
    const trimmedText = text.trim();

    let storedOptions;
    let storedCorrectAnswer;
    if (questionType === 'text_input') {
      // For text_input: options is metadata (or null), correctAnswer is pipe-delimited
      storedOptions = options || {};
      storedCorrectAnswer = correctAnswer.split('|').map(a => a.trim()).filter(a => a.length > 0).join('|');
    } else {
      // For multiple_choice: trim option values, keep correctAnswer as key
      storedOptions = Object.fromEntries(
        Object.entries(options).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
      );
      storedCorrectAnswer = correctAnswer;
    }

    // Create reward question
    const rewardQuestion = await prisma.rewardQuestion.create({
      data: {
        text: trimmedText,
        options: storedOptions,
        correctAnswer: storedCorrectAnswer,
        rewardAmount: parsedRewardAmount,
        questionType,
        matchMode,
        expiryTime: expiryTime ? new Date(expiryTime) : null,
        isActive: true,
        userId,
        isInstantReward,
        maxWinners,
        paymentProvider: isInstantReward ? paymentProvider : null,
        phoneNumber: isInstantReward ? phoneNumber : null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    log.info('Reward question created', { id: rewardQuestion.id });
    res.status(201).json({
      message: "Reward question created successfully",
      rewardQuestion: formatRewardQuestionPublic(rewardQuestion)
    });

  } catch (error) {
    log.error('Error creating reward question', { error: error.message });
    res.status(500).json({ message: "Failed to create reward question. Please try again." });
  }
});

// Get all active reward questions (with pagination + optional type filter)
export const getAllRewardQuestions = asyncHandler(async (req, res) => {
  try {
    const currentTime = new Date();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const typeFilter = req.query.type; // 'instant' | 'regular' | undefined (all)

    const where = {
      isActive: true,
      ...(typeFilter === 'instant' ? { isInstantReward: true } : {}),
      ...(typeFilter === 'regular' ? { isInstantReward: false } : {}),
      OR: [
        { expiryTime: null },
        { expiryTime: { gt: currentTime } },
      ],
    };

    const [rewardQuestions, totalCount] = await Promise.all([
      prisma.rewardQuestion.findMany(
        buildOptimizedQuery('RewardQuestion', {
          where,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
        }),
      ),
      prisma.rewardQuestion.count({ where }),
    ]);

    const formattedRewardQuestions = deduplicateById(rewardQuestions).map(rq => formatRewardQuestionPublic(rq));
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      message: "All reward questions fetched successfully",
      rewardQuestions: formattedRewardQuestions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    log.error('getAllRewardQuestions error', { error: error.message });
    res.status(500).json({ message: "Failed to fetch reward questions" });
  }
});

// Get regular (non-instant) reward questions only (with pagination)
export const getRegularRewardQuestions = asyncHandler(async (req, res) => {
  try {
    const currentTime = new Date();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Resolve authenticated user's email for attempt lookup
    const userId = req.user?.id;
    let userEmail = null;
    if (userId) {
      const authUser = await prisma.appUser.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      userEmail = authUser?.email ?? null;
    }

    const where = {
      isActive: true,
      isInstantReward: false,
      OR: [
        { expiryTime: null },
        { expiryTime: { gt: currentTime } },
      ],
    };

    const [rawQuestions, totalCount] = await Promise.all([
      prisma.rewardQuestion.findMany(
        buildOptimizedQuery('RewardQuestion', {
          where,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            winners: {
              select: {
                id: true,
                userEmail: true,
                position: true,
                amountAwarded: true,
                paymentStatus: true,
                createdAt: true,
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
        }),
      ),
      prisma.rewardQuestion.count({ where }),
    ]);

    // Deduplicate by id (safety net for offset/limit pagination edge cases)
    const rewardQuestions = deduplicateById(rawQuestions);

    // Fetch user's attempts for these questions so the client knows which are answered
    let userAttempts = [];
    if (userEmail && rewardQuestions.length > 0) {
      const questionIds = rewardQuestions.map(q => q.id);
      userAttempts = await prisma.rewardQuestionAttempt.findMany({
        where: {
          userEmail,
          rewardQuestionId: { in: questionIds },
        },
        select: {
          rewardQuestionId: true,
          selectedAnswer: true,
          isCorrect: true,
          attemptedAt: true,
        },
      });
    }

    const formattedRewardQuestions = rewardQuestions.map(rq => formatRewardQuestionPublic(rq));

    res.json({
      message: "Regular reward questions fetched successfully",
      rewardQuestions: formattedRewardQuestions,
      userAttempts: userAttempts.map(a => ({
        rewardQuestionId: a.rewardQuestionId,
        selectedAnswer: a.selectedAnswer,
        isCorrect: a.isCorrect,
        attemptedAt: a.attemptedAt instanceof Date ? a.attemptedAt.toISOString() : a.attemptedAt,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + rewardQuestions.length < totalCount,
      },
    });
  } catch (error) {
    log.error('getRegularRewardQuestions error', { error: error.message });
    res.status(500).json({ message: "Failed to fetch regular reward questions" });
  }
});

// Get instant reward questions only (with pagination)
export const getInstantRewardQuestions = asyncHandler(async (req, res) => {
  try {
    const currentTime = new Date();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Resolve authenticated user's email for attempt lookup
    const userId = req.user?.id;
    let userEmail = null;
    if (userId) {
      const authUser = await prisma.appUser.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      userEmail = authUser?.email ?? null;
    }

    const where = {
      isActive: true,
      isInstantReward: true,
      isCompleted: false,
      OR: [
        { expiryTime: null },
        { expiryTime: { gt: currentTime } },
      ],
    };

    const [rawQuestions, totalCount] = await Promise.all([
      prisma.rewardQuestion.findMany(
        buildOptimizedQuery('RewardQuestion', {
          where,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            winners: {
              select: {
                id: true,
                userEmail: true,
                position: true,
                amountAwarded: true,
                paymentStatus: true,
                createdAt: true,
              },
              orderBy: {
                position: 'asc',
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
        }),
      ),
      prisma.rewardQuestion.count({ where }),
    ]);

    // Deduplicate by id (safety net for offset/limit pagination edge cases)
    const instantRewardQuestions = deduplicateById(rawQuestions);

    // Fetch user's attempts for these questions so the client knows which are answered
    let userAttempts = [];
    if (userEmail && instantRewardQuestions.length > 0) {
      const questionIds = instantRewardQuestions.map(q => q.id);
      userAttempts = await prisma.rewardQuestionAttempt.findMany({
        where: {
          userEmail,
          rewardQuestionId: { in: questionIds },
        },
        select: {
          rewardQuestionId: true,
          selectedAnswer: true,
          isCorrect: true,
          attemptedAt: true,
        },
      });
    }

    const formattedInstantRewardQuestions = instantRewardQuestions.map(rq => formatRewardQuestionPublic(rq));

    res.json({
      message: "Instant reward questions fetched successfully",
      instantRewardQuestions: formattedInstantRewardQuestions,
      userAttempts: userAttempts.map(a => ({
        rewardQuestionId: a.rewardQuestionId,
        selectedAnswer: a.selectedAnswer,
        isCorrect: a.isCorrect,
        attemptedAt: a.attemptedAt instanceof Date ? a.attemptedAt.toISOString() : a.attemptedAt,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + instantRewardQuestions.length < totalCount,
      },
    });
  } catch (error) {
    log.error('getInstantRewardQuestions error', { error: error.message });
    res.status(500).json({ message: "Failed to fetch instant reward questions" });
  }
});

// Get reward question by ID
export const getRewardQuestionById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const rewardQuestion = await prisma.rewardQuestion.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        winners: {
          select: {
            id: true,
            userEmail: true,
            position: true,
            amountAwarded: true,
            paymentStatus: true,
            createdAt: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!rewardQuestion) {
      return res.status(404).json({ message: "Reward question not found" });
    }

    const formattedQuestion = formatRewardQuestionPublic(rewardQuestion);

    res.json({
      message: "Reward question fetched successfully",
      rewardQuestion: formattedQuestion
    });
  } catch (error) {
    log.error('getRewardQuestionById error', { error: error.message });
    res.status(500).json({ message: "Failed to fetch reward question" });
  }
});

// Get reward questions by user
export const getRewardQuestionsByUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Ownership check — users can only fetch their own reward questions
    if (req.user?.id !== userId) {
      return res.status(403).json({ message: "Forbidden: You can only view your own reward questions" });
    }

    const rewardQuestions = await prisma.rewardQuestion.findMany(
      buildOptimizedQuery('RewardQuestion', {
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    );

    const formattedQuestions = rewardQuestions.map(rq => formatRewardQuestionPublic(rq));
    res.json({
      message: "User reward questions fetched successfully",
      rewardQuestions: formattedQuestions,
    });
  } catch (error) {
    log.error('Error fetching user reward questions', { error: error.message });
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Update a reward question
export const updateRewardQuestion = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Ownership check — only the creator can update their reward question
    const existing = await prisma.rewardQuestion.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Reward question not found" });
    }
    if (existing.userId !== req.user?.id) {
      return res.status(403).json({ message: "You can only update your own reward questions" });
    }

    // Whitelist updateable fields — never allow changing correctAnswer, paymentProvider, phoneNumber, userId after creation
    const ALLOWED_UPDATE_FIELDS = ['text', 'options', 'rewardAmount', 'expiryTime', 'isActive', 'maxWinners'];
    const sanitizedData = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (updateData[key] !== undefined) {
        sanitizedData[key] = updateData[key];
      }
    }

    // Handle date fields if present
    if (sanitizedData.expiryTime) {
      sanitizedData.expiryTime = new Date(sanitizedData.expiryTime);
    }

    // If attempts exist, prevent changing correctAnswer (already blocked by whitelist, but also block text/options changes that could invalidate existing attempts)
    const attemptCount = await prisma.rewardQuestionAttempt.count({
      where: { rewardQuestionId: id },
    });
    if (attemptCount > 0) {
      // Remove correctAnswer from update even if it somehow passed the whitelist
      delete sanitizedData.correctAnswer;
    }

    const updatedRewardQuestion = await prisma.rewardQuestion.update({
      where: { id },
      data: sanitizedData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    res.json({
      message: "Reward question updated successfully",
      rewardQuestion: formatRewardQuestionPublic(updatedRewardQuestion),
    });
  } catch (error) {
    log.error('Error updating reward question', { error: error.message });
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Delete a reward question
export const deleteRewardQuestion = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Ownership check — only the creator can delete their reward question
    const existing = await prisma.rewardQuestion.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Reward question not found" });
    }
    if (existing.userId !== req.user?.id) {
      return res.status(403).json({ message: "You can only delete your own reward questions" });
    }

    await prisma.rewardQuestion.delete({
      where: { id },
    });

    res.json({ message: 'Reward question deleted successfully' });
  } catch (error) {
    log.error('Error deleting reward question', { error: error.message });
    res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * Declarative validation for answer submission request body.
 * Returns { valid: true, data } on success or { valid: false, error } on failure.
 */
function validateAnswerSubmission(body, params) {
  const rewardQuestionId = body.rewardQuestionId || params.id;
  if (!rewardQuestionId || typeof rewardQuestionId !== 'string') {
    return { valid: false, error: 'Reward question ID is required', code: 'MISSING_QUESTION_ID' };
  }

  const { selectedAnswer } = body;
  if (!selectedAnswer || typeof selectedAnswer !== 'string') {
    return { valid: false, error: 'Selected answer is required and must be a string', code: 'MISSING_ANSWER' };
  }
  if (selectedAnswer.length > 1000) {
    return { valid: false, error: 'Answer must be at most 1,000 characters', code: 'ANSWER_TOO_LONG' };
  }

  return { valid: true, data: { rewardQuestionId, selectedAnswer: selectedAnswer.trim() } };
}

// Submit an answer to a reward question
export const submitRewardQuestionAnswer = asyncHandler(async (req, res) => {
  try {
    // Declarative validation
    const validation = validateAnswerSubmission(req.body, req.params);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error, code: validation.code });
    }
    const { rewardQuestionId, selectedAnswer } = validation.data;

    // Token-bound identity: resolve user from verified JWT (set by verifyToken middleware)
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const authenticatedUser = await prisma.appUser.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, phone: true },
    });

    if (!authenticatedUser?.email) {
      return res.status(404).json({ message: "Authenticated user not found" });
    }

    const userEmail = authenticatedUser.email;
    // SECURITY: Only use verified phone from DB for automatic disbursements.
    // Never trust client-supplied phoneNumber for payouts — prevents redirect attacks.
    const resolvedPhone = authenticatedUser.phone || null;

    // Fetch the reward question first (needed for correctAnswer in all responses)
    const rewardQuestion = await prisma.rewardQuestion.findUnique({
      where: { id: rewardQuestionId }
    });

    if (!rewardQuestion) {
      return res.status(404).json({ message: "Reward question not found", code: 'QUESTION_NOT_FOUND' });
    }

    // SINGLE ATTEMPT ENFORCEMENT: Check if user has already attempted this reward question
    const existingAttempt = await prisma.rewardQuestionAttempt.findFirst({
      where: {
        userEmail,
        rewardQuestionId,
      }
    });

    if (existingAttempt) {
      return res.status(400).json({
        message: "You have already attempted this question. Each question can only be answered once.",
        code: 'ALREADY_ATTEMPTED',
        isCorrect: existingAttempt.isCorrect,
        alreadyAttempted: true
      });
    }

    // Check if question is active and not expired
    if (!rewardQuestion.isActive) {
      return res.status(400).json({ message: "This reward question is not active", code: 'QUESTION_INACTIVE' });
    }

    if (rewardQuestion.expiryTime && new Date() > rewardQuestion.expiryTime) {
      return res.status(400).json({
        message: "This reward question has expired",
        code: 'QUESTION_EXPIRED',
        isExpired: true
      });
    }

    // Check if question is completed (all winners found)
    if (rewardQuestion.isCompleted) {
      return res.status(400).json({
        message: "This question has already been completed. All winners have been found.",
        code: 'QUESTION_COMPLETED',
        isCompleted: true
      });
    }

    // Check if user has already won this question
    const existingWinner = await prisma.instantRewardWinner.findUnique({
      where: {
        rewardQuestionId_userEmail: {
          rewardQuestionId,
          userEmail
        }
      }
    });

    if (existingWinner) {
      return res.status(400).json({ message: "You have already won this question." });
    }

    // Check if answer is correct (constant-time comparison to prevent timing attacks)
    let isCorrect;
    if (rewardQuestion.questionType === 'text_input') {
      const accepted = rewardQuestion.correctAnswer.split('|').map(a => a.trim());
      const mode = rewardQuestion.matchMode || 'case_insensitive';
      if (mode === 'exact') {
        isCorrect = accepted.some(a => safeCompare(selectedAnswer.trim(), a));
      } else {
        const input = selectedAnswer.trim().toLowerCase();
        isCorrect = accepted.some(a => safeCompare(input, a.toLowerCase()));
      }
    } else {
      isCorrect = safeCompare(selectedAnswer, rewardQuestion.correctAnswer);
    }

    // Only reveal correctAnswer if the answer is correct, or the question is expired/completed (safe to reveal)
    const isExpired = rewardQuestion.expiryTime && new Date() > rewardQuestion.expiryTime;
    const questionNoLongerActive = rewardQuestion.isCompleted || isExpired;
    const shouldRevealAnswer = isCorrect || questionNoLongerActive;

    let response = {
      message: isCorrect ? "Correct answer! Points awarded." : "Incorrect answer. This question can only be attempted once.",
      isCorrect,
      ...(shouldRevealAnswer ? { correctAnswer: rewardQuestion.correctAnswer } : {}),
      pointsAwarded: 0,
      rewardEarned: 0,
      isWinner: false,
      position: null,
      paymentStatus: null,
      remainingSpots: Math.max(rewardQuestion.maxWinners - rewardQuestion.winnersCount, 0)
    };

    // If answer is correct, handle reward logic
    if (isCorrect) {
      // Dynamic reward amount from question model (fallback to config default)
      let rewardAmountUGX = rewardQuestion.rewardAmount;

      // Always fetch config — needed for ugxToPoints conversion
      let rewardConfig;
      try {
        rewardConfig = await getRewardConfig();
      } catch (configError) {
        log.warn('Failed to fetch reward config, using hardcoded fallback', { error: configError.message });
        rewardConfig = null;
      }

      if (!rewardAmountUGX || rewardAmountUGX <= 0) {
        rewardAmountUGX = rewardConfig
          ? (rewardQuestion.isInstantReward ? rewardConfig.defaultInstantRewardAmount : rewardConfig.defaultRegularRewardAmount)
          : 500; // Last-resort fallback
      }

      const rewardPoints = rewardConfig
        ? ugxToPoints(rewardAmountUGX, rewardConfig)
        : (Math.round(rewardAmountUGX / 40) || 5);

      if (rewardQuestion.isInstantReward) {
        // Transactional winner allocation with optimistic locking to prevent race conditions
        // Attempt record is created INSIDE the transaction so it rolls back on conflict
        const winnerResult = await prisma.$transaction(async (tx) => {
          // Record attempt inside transaction
          await tx.rewardQuestionAttempt.create({
            data: {
              userEmail,
              rewardQuestionId,
              selectedAnswer,
              isCorrect,
              attemptedAt: new Date()
            }
          });

          // Re-read with fresh data inside transaction
          const freshQuestion = await tx.rewardQuestion.findUnique({
            where: { id: rewardQuestionId },
          });

          if (!freshQuestion || freshQuestion.winnersCount >= freshQuestion.maxWinners) {
            // Question is full — still award points but no winner slot
            await tx.appUser.update({
              where: { email: userEmail },
              data: { points: { increment: rewardPoints } },
            });
            return { isWinner: false, reason: 'FULL' };
          }

          const position = freshQuestion.winnersCount + 1;

          // Determine winner's phone — NEVER fall back to question creator's phone
          const winnerPhone = resolvedPhone || null;
          const initialPaymentStatus = winnerPhone ? 'PENDING' : 'FAILED';

          // Create winner record
          const winner = await tx.instantRewardWinner.create({
            data: {
              rewardQuestionId,
              userEmail,
              position,
              amountAwarded: rewardAmountUGX,
              paymentStatus: initialPaymentStatus,
              paymentProvider: rewardQuestion.paymentProvider || null,
              phoneNumber: winnerPhone,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // Atomic increment with optimistic lock on winnersCount
          const updated = await tx.rewardQuestion.updateMany({
            where: {
              id: rewardQuestionId,
              winnersCount: freshQuestion.winnersCount,
              isActive: true,
              isCompleted: false,
            },
            data: {
              winnersCount: { increment: 1 },
              isCompleted: position >= freshQuestion.maxWinners,
            },
          });

          if (updated.count === 0) {
            throw new Error('CONCURRENT_WINNER_CONFLICT');
          }

          // Award points within transaction
          await tx.appUser.update({
            where: { email: userEmail },
            data: { points: { increment: rewardPoints } },
          });

          return { isWinner: true, winner, position, maxWinners: freshQuestion.maxWinners };
        }, {
          timeout: 10000,
        });

        if (winnerResult.isWinner) {
          const winnerRecord = winnerResult.winner;

          // Fire-and-forget: process payment asynchronously so the HTTP response
          // returns immediately. The user sees paymentStatus: 'PENDING' and the
          // frontend/SSE updates when the disbursement resolves.
          if (winnerRecord.phoneNumber && winnerRecord.paymentProvider) {
            processInstantRewardPayment(winnerRecord).catch((paymentError) => {
              log.error('Instant reward payment processing failed', {
                winnerId: winnerRecord.id,
                message: paymentError.message,
              });
            });
          } else {
            log.warn('Winner missing phone or provider — payment deferred', {
              winnerId: winnerRecord.id,
              hasPhone: !!winnerRecord.phoneNumber,
              hasProvider: !!winnerRecord.paymentProvider,
            });
          }

          const { position, maxWinners } = winnerResult;

          // SSE: notify about instant reward deposit
          publishEvent(authenticatedUser.id, 'transaction.new', {
            type: 'deposit',
            amount: rewardAmountUGX,
            description: `Instant Reward Won — Position #${position}`,
          });

          // Persistent notification for reward earned
          createNotificationFromTemplateHelper(authenticatedUser.id, 'REWARD_EARNED', { points: rewardPoints }).catch(() => {});

          response = {
            ...response,
            message: `Congratulations! You are the ${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} winner! You earned ${rewardAmountUGX} UGX (${rewardPoints} points)!`,
            isCorrect: true,
            pointsAwarded: rewardPoints,
            rewardEarned: rewardAmountUGX,
            isWinner: true,
            position,
            paymentStatus: 'PENDING', // Payment is processed asynchronously — SSE updates on resolution
            paymentReference: null,
            remainingSpots: Math.max(maxWinners - position, 0),
          };
        } else {
          response = {
            ...response,
            message: `Correct answer! However, all winners have already been found for this question. You still earned ${rewardPoints} points!`,
            isCorrect: true,
            pointsAwarded: rewardPoints,
            rewardEarned: rewardAmountUGX,
            isWinner: false,
            position: null,
            paymentStatus: null,
            remainingSpots: 0,
            isCompleted: true,
          };
        }
      } else {
        // Regular reward question — wrap attempt + reward + points in a transaction
        await prisma.$transaction(async (tx) => {
          // Record attempt inside transaction
          await tx.rewardQuestionAttempt.create({
            data: {
              userEmail,
              rewardQuestionId,
              selectedAnswer,
              isCorrect,
              attemptedAt: new Date()
            }
          });

          // Award dynamic points
          await tx.appUser.update({
            where: { email: userEmail },
            data: {
              points: {
                increment: rewardPoints
              }
            }
          });

          // Create reward record (store points, not UGX — consistent with user.points)
          await tx.reward.create({
            data: {
              userEmail,
              points: rewardPoints,
              description: `Correct answer to reward question: ${rewardQuestion.text.substring(0, 50)}...`
            }
          });
        });

        // SSE: notify about regular reward earned
        publishEvent(authenticatedUser.id, 'transaction.new', {
          type: 'reward',
          amount: rewardPoints,
          description: 'Reward Question Answered',
        });

        // Persistent notification for reward earned
        createNotificationFromTemplateHelper(authenticatedUser.id, 'REWARD_EARNED', { points: rewardPoints }).catch(() => {});

        response.pointsAwarded = rewardPoints;
        response.rewardEarned = rewardAmountUGX;
        response.message = `Correct! You earned ${rewardAmountUGX} UGX (${rewardPoints} points)!`;
      }
    } else {
      // Incorrect answer — still record the attempt in its own call
      await prisma.rewardQuestionAttempt.create({
        data: {
          userEmail,
          rewardQuestionId,
          selectedAnswer,
          isCorrect,
          attemptedAt: new Date()
        }
      });
    }

    res.json(response);

  } catch (error) {
    log.error('Error submitting reward question answer', { error: error.message, stack: error.stack });
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Process automatic payment for instant reward winners
// Implements retry with exponential backoff (Stripe/Cash App best practice)
const PAYMENT_MAX_RETRIES = 3;
const PAYMENT_BASE_DELAY_MS = 1000;

/**
 * Auto-detect provider from Uganda phone prefix.
 * MTN: 077, 078, 076, 039 | Airtel: 070, 075
 */
function detectProviderFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('256') && local.length >= 12) local = '0' + local.slice(3);
  if (/^07[678]/.test(local) || /^039/.test(local)) return 'MTN';
  if (/^07[05]/.test(local)) return 'AIRTEL';
  return null;
}

async function processInstantRewardPayment(winner, attempt = 1) {
  // Import once (Node caches ES modules) — avoid top-level circular dep
  const {
    processMtnPayment, processAirtelPayment,
    checkMtnCollectionStatus, checkAirtelCollectionStatus,
  } = await import('./paymentController.mjs');
  const { v4: uuidv4 } = await import('uuid');

  // Resolve userId once for SSE events
  const winnerUser = attempt === 1
    ? await prisma.appUser.findUnique({ where: { email: winner.userEmail }, select: { id: true } })
    : winner._resolvedUserId ? { id: winner._resolvedUserId } : null;
  if (winnerUser) winner._resolvedUserId = winnerUser.id;

  const emitSettlement = (status, reference) => {
    if (!winnerUser) return;
    publishEvent(winnerUser.id, 'transaction.statusUpdate', {
      type: 'instant_reward',
      status,
      amount: winner.amountAwarded,
      reference: reference || null,
      winnerId: winner.id,
    });
  };

  try {
    // Validate phone
    if (!winner.phoneNumber) {
      log.error('Cannot process payment: missing phone number', { winnerId: winner.id });
      await prisma.instantRewardWinner.update({
        where: { id: winner.id },
        data: { paymentStatus: 'FAILED', updatedAt: new Date() },
      });
      emitSettlement('FAILED', null);
      return { status: 'FAILED', reference: null, reason: 'MISSING_PHONE' };
    }

    // Determine provider — explicit field or auto-detect from phone prefix
    let provider = winner.paymentProvider;
    if (!provider) {
      provider = detectProviderFromPhone(winner.phoneNumber);
    }
    if (!provider) {
      log.error('Cannot determine payment provider', {
        winnerId: winner.id,
        phone: maskPhone(winner.phoneNumber),
      });
      await prisma.instantRewardWinner.update({
        where: { id: winner.id },
        data: { paymentStatus: 'FAILED', updatedAt: new Date() },
      });
      emitSettlement('FAILED', null);
      return { status: 'FAILED', reference: null, reason: 'UNKNOWN_PROVIDER' };
    }

    // IDEMPOTENCY: Generate reference once on first attempt, reuse on retries.
    // Store on winner record so retries (including after server restart) use the same ref.
    let referenceId = winner.paymentReference;
    if (!referenceId) {
      referenceId = uuidv4();
      await prisma.instantRewardWinner.update({
        where: { id: winner.id },
        data: { paymentReference: referenceId, updatedAt: new Date() },
      });
      winner.paymentReference = referenceId;
    }

    // On retry, check if previous attempt actually succeeded at provider level
    // before initiating a new disbursement (prevents double-payout)
    if (attempt > 1 && referenceId) {
      try {
        let providerStatus;
        if (provider === 'MTN') {
          providerStatus = await checkMtnCollectionStatus(referenceId);
        } else {
          providerStatus = await checkAirtelCollectionStatus(referenceId);
        }
        if (providerStatus === 'SUCCESSFUL') {
          log.info('Previous disbursement actually succeeded at provider', { winnerId: winner.id, referenceId });
          await prisma.instantRewardWinner.update({
            where: { id: winner.id },
            data: { paymentStatus: 'SUCCESSFUL', paidAt: new Date(), updatedAt: new Date() },
          });
          emitSettlement('SUCCESSFUL', referenceId);
          return { status: 'SUCCESSFUL', reference: referenceId };
        }
      } catch (statusErr) {
        log.warn('Provider status check failed before retry, proceeding with new attempt', {
          winnerId: winner.id, error: statusErr.message,
        });
      }
    }

    log.info('Processing instant reward payment', {
      email: winner.userEmail,
      amount: winner.amountAwarded,
      provider,
      attempt,
      referenceId,
    });

    let paymentResult = null;
    if (provider === 'MTN') {
      paymentResult = await processMtnPayment({
        amount: winner.amountAwarded,
        phoneNumber: winner.phoneNumber,
        userId: winner.userEmail,
        reason: `Instant reward payment - Question winner #${winner.position}`,
        referenceId,
      });
    } else if (provider === 'AIRTEL') {
      paymentResult = await processAirtelPayment({
        amount: winner.amountAwarded,
        phoneNumber: winner.phoneNumber,
        userId: winner.userEmail,
        reason: `Instant reward payment - Question winner #${winner.position}`,
        referenceId,
      });
    }

    if (paymentResult && paymentResult.success) {
      await prisma.instantRewardWinner.update({
        where: { id: winner.id },
        data: {
          paymentStatus: 'SUCCESSFUL',
          paymentReference: paymentResult.reference,
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      });

      log.info('Instant reward payment successful', {
        email: winner.userEmail,
        reference: paymentResult.reference,
      });
      emitSettlement('SUCCESSFUL', paymentResult.reference);
      return { status: 'SUCCESSFUL', reference: paymentResult.reference };
    } else {
      // M3: Only retry if the failure is transient (5xx / network / timeout).
      // Non-transient errors (4xx, terminal provider status) fail immediately.
      const canRetry = paymentResult?.retryable !== false && attempt < PAYMENT_MAX_RETRIES;

      if (canRetry) {
        const delay = PAYMENT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        log.warn('Instant reward payment attempt failed, retrying', { attempt, delayMs: delay });
        await new Promise(resolve => setTimeout(resolve, delay));
        return processInstantRewardPayment(winner, attempt + 1);
      }

      // M4: If the provider is still processing (pending: true), keep PENDING
      // so the reconciliation job can resolve it later.
      const finalStatus = paymentResult?.pending ? 'PENDING' : 'FAILED';

      await prisma.instantRewardWinner.update({
        where: { id: winner.id },
        data: { paymentStatus: finalStatus, updatedAt: new Date() },
      });

      if (finalStatus === 'FAILED') {
        log.error('Instant reward payment failed after all retries', {
          email: winner.userEmail,
          attempts: attempt,
        });
        emitSettlement('FAILED', null);
      } else {
        log.warn('Instant reward payment still pending at provider, leaving for reconciliation', {
          email: winner.userEmail,
          reference: paymentResult?.reference,
        });
      }
      return { status: finalStatus, reference: paymentResult?.reference || null };
    }
  } catch (error) {
    log.error('Instant reward payment error', {
      email: winner.userEmail,
      attempt,
      message: error.message,
    });

    // M3: Only retry on transient errors. 4xx / circuit-open = fail immediately.
    const status = error.response?.status;
    const isNonTransient = (status && status >= 400 && status < 500) || error.circuitOpen;

    if (!isNonTransient && attempt < PAYMENT_MAX_RETRIES) {
      const delay = PAYMENT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log.warn('Retrying after payment error', { attempt, delayMs: delay });
      await new Promise(resolve => setTimeout(resolve, delay));
      return processInstantRewardPayment(winner, attempt + 1);
    }

    await prisma.instantRewardWinner.update({
      where: { id: winner.id },
      data: { paymentStatus: 'FAILED', updatedAt: new Date() },
    });

    emitSettlement('FAILED', null);
    return { status: 'FAILED', reference: null };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// C1: Admin retry & reconciliation for stale/failed disbursements
// ────────────────────────────────────────────────────────────────────────────

/** How long a PENDING winner should sit before reconciliation considers it stale */
const STALE_PENDING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /admin/retry-failed-disbursements
 * Admin-only. Retries all FAILED InstantRewardWinner records that still have a
 * phone number (i.e. are eligible for retry). Returns per-record outcomes.
 */
export const retryFailedDisbursements = asyncHandler(async (req, res) => {
  const failedWinners = await prisma.instantRewardWinner.findMany({
    where: {
      paymentStatus: 'FAILED',
      phoneNumber: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: 50, // cap per batch to avoid overwhelming providers
  });

  if (failedWinners.length === 0) {
    return res.json({ retried: 0, results: [], message: 'No failed disbursements to retry.' });
  }

  log.info('Admin retrying failed disbursements', { count: failedWinners.length });

  // Reset status to PENDING before retrying so processInstantRewardPayment
  // treats them as fresh (with existing idempotent referenceId)
  const ids = failedWinners.map(w => w.id);
  await prisma.instantRewardWinner.updateMany({
    where: { id: { in: ids } },
    data: { paymentStatus: 'PENDING', updatedAt: new Date() },
  });

  // Fire-and-forget — results trickle in via SSE
  const results = [];
  for (const winner of failedWinners) {
    try {
      const result = await processInstantRewardPayment(winner);
      results.push({ winnerId: winner.id, email: winner.userEmail, ...result });
    } catch (err) {
      results.push({ winnerId: winner.id, email: winner.userEmail, status: 'ERROR', reason: err.message });
    }
  }

  res.json({ retried: failedWinners.length, results });
});

/**
 * POST /admin/reconcile-disbursements
 * Admin-only. Finds PENDING InstantRewardWinner records older than 5 minutes,
 * checks their status at the provider level, and either marks them SUCCESSFUL
 * or retries them.
 */
export const reconcileStaleDisbursements = asyncHandler(async (req, res) => {
  const {
    checkMtnCollectionStatus, checkAirtelCollectionStatus,
  } = await import('./paymentController.mjs');

  const cutoff = new Date(Date.now() - STALE_PENDING_THRESHOLD_MS);

  const staleWinners = await prisma.instantRewardWinner.findMany({
    where: {
      paymentStatus: 'PENDING',
      updatedAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  if (staleWinners.length === 0) {
    return res.json({ reconciled: 0, results: [], message: 'No stale PENDING disbursements found.' });
  }

  log.info('Reconciling stale PENDING disbursements', { count: staleWinners.length });

  const results = [];
  for (const winner of staleWinners) {
    try {
      // If there's a reference, check provider status first
      if (winner.paymentReference) {
        const provider = winner.paymentProvider || detectProviderFromPhone(winner.phoneNumber);
        let providerStatus;
        try {
          if (provider === 'MTN') {
            providerStatus = await checkMtnCollectionStatus(winner.paymentReference);
          } else if (provider === 'AIRTEL') {
            providerStatus = await checkAirtelCollectionStatus(winner.paymentReference);
          }
        } catch { /* provider check failed, will retry */ }

        if (providerStatus === 'SUCCESSFUL') {
          await prisma.instantRewardWinner.update({
            where: { id: winner.id },
            data: { paymentStatus: 'SUCCESSFUL', paidAt: new Date(), updatedAt: new Date() },
          });
          results.push({ winnerId: winner.id, action: 'CONFIRMED_SUCCESSFUL', reference: winner.paymentReference });
          continue;
        }
      }

      // Provider doesn't show success — retry the disbursement
      const result = await processInstantRewardPayment(winner);
      results.push({ winnerId: winner.id, action: 'RETRIED', ...result });
    } catch (err) {
      results.push({ winnerId: winner.id, action: 'ERROR', reason: err.message });
    }
  }

  res.json({ reconciled: staleWinners.length, results });
});
