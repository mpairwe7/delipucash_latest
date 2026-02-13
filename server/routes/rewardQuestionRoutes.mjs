import express from 'express';
import {
  createRewardQuestion,
  getAllRewardQuestions,
  getInstantRewardQuestions,
  getRewardQuestionById,
  getRewardQuestionsByUser,
  updateRewardQuestion,
  deleteRewardQuestion,
  submitRewardQuestionAnswer
} from '../controllers/rewardQuestionController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// Public routes (read-only)
router.get('/all', getAllRewardQuestions);
router.get('/instant', getInstantRewardQuestions);
router.get('/:id', getRewardQuestionById);
router.get('/user/:userId', getRewardQuestionsByUser);

// Protected routes (require authentication)
router.post('/create', verifyToken, createRewardQuestion);
router.put('/:id/update', verifyToken, updateRewardQuestion);
router.delete('/:id/delete', verifyToken, deleteRewardQuestion);
router.post('/:id/answer', verifyToken, submitRewardQuestionAnswer);
router.post('/submit-answer', verifyToken, submitRewardQuestionAnswer);

export default router; 