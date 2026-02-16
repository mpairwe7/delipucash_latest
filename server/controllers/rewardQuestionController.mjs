import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';

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

// Create a new reward question
export const createRewardQuestion = asyncHandler(async (req, res) => {
  try {
    console.log("Creating reward question with data:", req.body);

    const {
      text,
      options,
      correctAnswer,
      rewardAmount,
      expiryTime,
      isInstantReward = false,
      maxWinners = 2,
      paymentProvider,
      phoneNumber
    } = req.body;

    // Token-bound identity: use authenticated user from JWT
    const userId = req.user?.id;

    // Validate required fields
    if (!text || !options || !correctAnswer || !rewardAmount || !userId) {
      return res.status(400).json({
        message: "Text, options, correctAnswer, and rewardAmount are required"
      });
    }

    // Validate reward amount
    if (rewardAmount <= 0) {
      return res.status(400).json({ 
        message: "Reward amount must be greater than 0" 
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

    // Create reward question
    const rewardQuestion = await prisma.rewardQuestion.create({
      data: {
        text,
        options,
        correctAnswer,
        rewardAmount,
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

    console.log("Reward question created successfully:", rewardQuestion.id);
    res.status(201).json({
      message: "Reward question created successfully",
      rewardQuestion: formatRewardQuestionPublic(rewardQuestion)
    });

  } catch (error) {
    console.error("Error creating reward question:", error);
    res.status(500).json({ message: "Something went wrong" });
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
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take: limit,
        }),
      ),
      prisma.rewardQuestion.count({ where }),
    ]);

    const formattedRewardQuestions = rewardQuestions.map(rq => formatRewardQuestionPublic(rq));
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
    console.error("RewardQuestionController: getAllRewardQuestions - Error occurred:", error);
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

    const where = {
      isActive: true,
      isInstantReward: false,
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
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take: limit,
        }),
      ),
      prisma.rewardQuestion.count({ where }),
    ]);

    const formattedRewardQuestions = rewardQuestions.map(rq => formatRewardQuestionPublic(rq));

    res.json({
      message: "Regular reward questions fetched successfully",
      rewardQuestions: formattedRewardQuestions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + rewardQuestions.length < totalCount,
      },
    });
  } catch (error) {
    console.error("RewardQuestionController: getRegularRewardQuestions - Error occurred:", error);
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

    const where = {
      isActive: true,
      isInstantReward: true,
      isCompleted: false,
      OR: [
        { expiryTime: null },
        { expiryTime: { gt: currentTime } },
      ],
    };

    const [instantRewardQuestions, totalCount] = await Promise.all([
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
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take: limit,
        }),
      ),
      prisma.rewardQuestion.count({ where }),
    ]);

    const formattedInstantRewardQuestions = instantRewardQuestions.map(rq => formatRewardQuestionPublic(rq));

    res.json({
      message: "Instant reward questions fetched successfully",
      instantRewardQuestions: formattedInstantRewardQuestions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + instantRewardQuestions.length < totalCount,
      },
    });
  } catch (error) {
    console.error("RewardQuestionController: getInstantRewardQuestions - Error occurred:", error);
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
    console.error("RewardQuestionController: getRewardQuestionById - Error occurred:", error);
    res.status(500).json({ message: "Failed to fetch reward question" });
  }
});

// Get reward questions by user
export const getRewardQuestionsByUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    
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
    console.error("Error fetching user reward questions:", error);
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

    // Handle date fields if present
    if (updateData.expiryTime) {
      updateData.expiryTime = new Date(updateData.expiryTime);
    }

    const updatedRewardQuestion = await prisma.rewardQuestion.update({
      where: { id },
      data: updateData,
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
    console.error("Error updating reward question:", error);
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
    console.error("Error deleting reward question:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Submit an answer to a reward question
export const submitRewardQuestionAnswer = asyncHandler(async (req, res) => {
  try {
    // Support both body-based and URL param-based questionId
    const rewardQuestionId = req.body.rewardQuestionId || req.params.id;
    const { selectedAnswer, phoneNumber } = req.body;

    // Validate required fields
    if (!rewardQuestionId || !selectedAnswer) {
      return res.status(400).json({
        message: "Reward question ID and selected answer are required"
      });
    }

    // Token-bound identity: resolve user from verified JWT (set by verifyToken middleware)
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const authenticatedUser = await prisma.appUser.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true },
    });

    if (!authenticatedUser?.email) {
      return res.status(404).json({ message: "Authenticated user not found" });
    }

    const userEmail = authenticatedUser.email;

    // Fetch the reward question first (needed for correctAnswer in all responses)
    const rewardQuestion = await prisma.rewardQuestion.findUnique({
      where: { id: rewardQuestionId }
    });

    if (!rewardQuestion) {
      return res.status(404).json({ message: "Reward question not found" });
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
        isCorrect: existingAttempt.isCorrect,
        alreadyAttempted: true
      });
    }

    // Check if question is active and not expired
    if (!rewardQuestion.isActive) {
      return res.status(400).json({ message: "This reward question is not active" });
    }

    if (rewardQuestion.expiryTime && new Date() > rewardQuestion.expiryTime) {
      return res.status(400).json({
        message: "This reward question has expired",
        isExpired: true
      });
    }

    // Check if question is completed (all winners found)
    if (rewardQuestion.isCompleted) {
      return res.status(400).json({
        message: "This question has already been completed. All winners have been found.",
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

    // Check if answer is correct
    const isCorrect = selectedAnswer === rewardQuestion.correctAnswer;

    // Create reward question attempt (dedicated model — no FK to Question table)
    await prisma.rewardQuestionAttempt.create({
      data: {
        userEmail,
        rewardQuestionId,
        selectedAnswer,
        isCorrect,
        attemptedAt: new Date()
      }
    });

    let response = {
      message: isCorrect ? "Correct answer! Points awarded." : "Incorrect answer. This question can only be attempted once.",
      isCorrect,
      correctAnswer: rewardQuestion.correctAnswer,
      pointsAwarded: 0,
      rewardEarned: 0,
      isWinner: false,
      position: null,
      paymentStatus: null,
      remainingSpots: Math.max(rewardQuestion.maxWinners - rewardQuestion.winnersCount, 0)
    };

    // If answer is correct, handle reward logic
    if (isCorrect) {
      // Dynamic reward amount from question model (fallback to 500 UGX / 5 points)
      const rewardAmountUGX = rewardQuestion.rewardAmount || 500;
      const rewardPoints = Math.round(rewardAmountUGX / 100) || 5;

      if (rewardQuestion.isInstantReward) {
        // Transactional winner allocation with optimistic locking to prevent race conditions
        const winnerResult = await prisma.$transaction(async (tx) => {
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

          // Create winner record
          const winner = await tx.instantRewardWinner.create({
            data: {
              rewardQuestionId,
              userEmail,
              position,
              amountAwarded: rewardAmountUGX,
              paymentStatus: 'PENDING',
              paymentProvider: rewardQuestion.paymentProvider,
              phoneNumber: phoneNumber || rewardQuestion.phoneNumber,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // Atomic increment with optimistic lock on winnersCount
          const updated = await tx.rewardQuestion.updateMany({
            where: {
              id: rewardQuestionId,
              winnersCount: freshQuestion.winnersCount,
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
          // Process payment OUTSIDE transaction (async, non-blocking)
          let paymentResult = null;
          try {
            paymentResult = await processInstantRewardPayment(winnerResult.winner);
          } catch (paymentError) {
            console.error("Payment processing error:", paymentError);
          }

          const { position, maxWinners } = winnerResult;
          response = {
            ...response,
            message: `Congratulations! You are the ${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} winner! You earned ${rewardAmountUGX} UGX (${rewardPoints} points)!`,
            isCorrect: true,
            pointsAwarded: rewardAmountUGX,
            rewardEarned: rewardAmountUGX,
            isWinner: true,
            position,
            paymentStatus: paymentResult?.status || 'PENDING',
            paymentReference: paymentResult?.reference,
            remainingSpots: Math.max(maxWinners - position, 0),
          };
        } else {
          response = {
            ...response,
            message: `Correct answer! However, all winners have already been found for this question. You still earned ${rewardPoints} points!`,
            isCorrect: true,
            pointsAwarded: rewardAmountUGX,
            rewardEarned: rewardAmountUGX,
            isWinner: false,
            position: null,
            paymentStatus: null,
            remainingSpots: 0,
            isCompleted: true,
          };
        }
      } else {
        // Regular reward question — award dynamic points
        await prisma.appUser.update({
          where: { email: userEmail },
          data: {
            points: {
              increment: rewardPoints
            }
          }
        });

        // Create reward record (store points, not UGX — consistent with user.points)
        await prisma.reward.create({
          data: {
            userEmail,
            points: rewardPoints,
            description: `Correct answer to reward question: ${rewardQuestion.text.substring(0, 50)}...`
          }
        });

        response.pointsAwarded = rewardAmountUGX;
        response.rewardEarned = rewardAmountUGX;
        response.message = `Correct! You earned ${rewardAmountUGX} UGX (${rewardPoints} points)!`;
      }
    }

    res.json(response);

  } catch (error) {
    console.error("Error submitting reward question answer:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Process automatic payment for instant reward winners
async function processInstantRewardPayment(winner) {
  try {
    console.log(`Processing payment for winner: ${winner.userEmail}, Amount: ${winner.amountAwarded}, Provider: ${winner.paymentProvider}`);

    // Import payment controller functions
    const { processMtnPayment, processAirtelPayment } = await import('./paymentController.mjs');

    let paymentResult = null;

    if (winner.paymentProvider === 'MTN') {
      paymentResult = await processMtnPayment({
        amount: winner.amountAwarded,
        phoneNumber: winner.phoneNumber,
        userId: winner.userEmail,
        reason: `Instant reward payment - Question winner #${winner.position}`
      });
    } else if (winner.paymentProvider === 'AIRTEL') {
      paymentResult = await processAirtelPayment({
        amount: winner.amountAwarded,
        phoneNumber: winner.phoneNumber,
        userId: winner.userEmail,
        reason: `Instant reward payment - Question winner #${winner.position}`
      });
    }

    if (paymentResult && paymentResult.success) {
      // Update winner record with payment details
      await prisma.instantRewardWinner.update({
        where: { id: winner.id },
        data: {
          paymentStatus: 'SUCCESSFUL',
          paymentReference: paymentResult.reference,
          paidAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`Payment successful for winner ${winner.userEmail}: ${paymentResult.reference}`);
      return {
        status: 'SUCCESSFUL',
        reference: paymentResult.reference
      };
    } else {
      // Update winner record as failed
      await prisma.instantRewardWinner.update({
        where: { id: winner.id },
        data: {
          paymentStatus: 'FAILED',
          updatedAt: new Date()
        }
      });

      console.log(`Payment failed for winner ${winner.userEmail}`);
      return {
        status: 'FAILED',
        reference: null
      };
    }
  } catch (error) {
    console.error(`Error processing payment for winner ${winner.userEmail}:`, error);
    
    // Update winner record as failed
    await prisma.instantRewardWinner.update({
      where: { id: winner.id },
      data: {
        paymentStatus: 'FAILED',
        updatedAt: new Date()
      }
    });

    return {
      status: 'FAILED',
      reference: null
    };
  }
} 