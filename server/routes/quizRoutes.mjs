import express from 'express';
import { verifyToken } from '../utils/authToken.mjs';
import {
  getUploadedQuestions,
  getUserPoints,
  updateUserPoints,
  saveQuizSession,
  redeemReward,
  initiateDisbursement,
} from '../controllers/quizSessionController.mjs';

const router = express.Router();

/**
 * Quiz Session Routes
 * Handles quiz questions, points management, and reward redemption
 */

// Get quiz questions
// GET /api/quiz/questions
router.get('/questions', verifyToken, getUploadedQuestions);

// Get user points
// GET /api/quiz/points/:userId
router.get('/points/:userId', verifyToken, getUserPoints);

// Update user points after quiz session
// PUT /api/quiz/points
router.put('/points', verifyToken, updateUserPoints);

// Save completed quiz session
// POST /api/quiz/sessions
router.post('/sessions', verifyToken, saveQuizSession);

// Redeem points for cash/airtime
// POST /api/quiz/redeem
router.post('/redeem', verifyToken, redeemReward);

// Initiate disbursement
// POST /api/quiz/disburse
router.post('/disburse', verifyToken, initiateDisbursement);

export default router;
