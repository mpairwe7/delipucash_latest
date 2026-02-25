import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createRewardQuestion,
  getAllRewardQuestions,
  getRegularRewardQuestions,
  getInstantRewardQuestions,
  getRewardQuestionById,
  getRewardQuestionsByUser,
  updateRewardQuestion,
  deleteRewardQuestion,
  submitRewardQuestionAnswer,
  retryFailedDisbursements,
  reconcileStaleDisbursements,
} from '../controllers/rewardQuestionController.mjs';
import { verifyToken, requireModerator, requireAdmin } from '../utils/verifyUser.mjs';

const router = express.Router();

/** Answer submission: 10 requests per minute per IP */
const answerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many answer submissions. Please try again in a minute.' },
});

// Protected read routes (require authentication — sensitive data stripped from responses)
router.get('/all', verifyToken, getAllRewardQuestions);
router.get('/regular', verifyToken, getRegularRewardQuestions);
router.get('/instant', verifyToken, getInstantRewardQuestions);
router.get('/user/:userId', verifyToken, getRewardQuestionsByUser);
router.get('/:id', verifyToken, getRewardQuestionById);

// Protected routes (require admin/moderator role)
router.post('/create', verifyToken, requireModerator, createRewardQuestion);
router.put('/:id/update', verifyToken, requireModerator, updateRewardQuestion);
router.delete('/:id/delete', verifyToken, requireModerator, deleteRewardQuestion);
router.post('/:id/answer', answerLimiter, verifyToken, submitRewardQuestionAnswer);
router.post('/submit-answer', answerLimiter, verifyToken, submitRewardQuestionAnswer);

// Admin-only: disbursement retry & reconciliation (C1)
router.post('/admin/retry-failed-disbursements', verifyToken, requireAdmin, retryFailedDisbursements);
router.post('/admin/reconcile-disbursements', verifyToken, requireAdmin, reconcileStaleDisbursements);

export default router;