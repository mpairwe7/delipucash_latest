import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';
import { publishEvent } from '../lib/eventBus.mjs';

// Record a Question Attempt
export const recordAttempt = asyncHandler(async (req, res) => {
  const { userPhoneNumber, questionId, selectedAnswer } = req.body;

  // Resolve user by phone to align with email-based QuestionAttempt relation
  const user = await prisma.appUser.findUnique({ where: { phone: userPhoneNumber } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    return res.status(404).json({ message: 'Question not found' });
  }

  const isCorrect = question.correctAnswer === selectedAnswer;

  const attempt = await prisma.questionAttempt.create({
    data: {
      user: { connect: { email: user.email } },
      question: { connect: { id: questionId } },
      selectedAnswer,
      isCorrect,
    },
  });

  // SSE: Notify user of attempt result (and question author if different)
  publishEvent(user.id, 'question.attempt', {
    attemptId: attempt.id,
    questionId,
    isCorrect,
  }).catch(() => {});
  if (question.userId && question.userId !== user.id) {
    publishEvent(question.userId, 'question.newAttempt', {
      attemptId: attempt.id,
      questionId,
    }).catch(() => {});
  }

  res.status(201).json({ message: 'Attempt recorded', attempt });
});

// Get Attempts by User
export const getAttemptsByUser = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.params;

  const user = await prisma.appUser.findUnique({ where: { phone: phoneNumber } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const attempts = await prisma.questionAttempt.findMany(
    buildOptimizedQuery('QuestionAttempt', {
      where: { userEmail: user.email },
      orderBy: [{ createdAt: 'desc' }],
    }),
  );

  res.json(attempts);
});
