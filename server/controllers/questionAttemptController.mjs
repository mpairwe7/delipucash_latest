import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { buildOptimizedQuery } from '../lib/queryStrategies.mjs';

// Record a Question Attempt
export const recordAttempt = asyncHandler(async (req, res) => {
  const { userPhoneNumber, questionId, selectedAnswer } = req.body;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    return res.status(404).json({ message: 'Question not found' });
  }

  const isCorrect = question.correctAnswer === selectedAnswer;

  const attempt = await prisma.questionAttempt.create({
    data: {
      user: { connect: { phoneNumber: userPhoneNumber } },
      question: { connect: { id: questionId } },
      selectedAnswer,
      isCorrect,
    },
  });

  res.status(201).json({ message: 'Attempt recorded', attempt });
});

// Get Attempts by User
export const getAttemptsByUser = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.params;

  const attempts = await prisma.questionAttempt.findMany(
    buildOptimizedQuery('QuestionAttempt', {
      where: { userPhoneNumber: phoneNumber },
      orderBy: [{ createdAt: 'desc' }],
    }),
  );

  res.json(attempts);
});
