import express from 'express';
import {
  createRewardQuestion,
  getAllRewardQuestions,
  getRegularRewardQuestions,
  getInstantRewardQuestions,
  getRewardQuestionById,
  getRewardQuestionsByUser,
  updateRewardQuestion,
  deleteRewardQuestion,
  submitRewardQuestionAnswer
} from '../controllers/rewardQuestionController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// Protected read routes (require authentication — sensitive data stripped from responses)
router.get('/all', verifyToken, getAllRewardQuestions);
router.get('/regular', verifyToken, getRegularRewardQuestions);
router.get('/instant', verifyToken, getInstantRewardQuestions);
router.get('/user/:userId', verifyToken, getRewardQuestionsByUser);
router.get('/:id', verifyToken, getRewardQuestionById);

// Protected routes (require authentication)
router.post('/create', verifyToken, createRewardQuestion);
router.put('/:id/update', verifyToken, updateRewardQuestion);
router.delete('/:id/delete', verifyToken, deleteRewardQuestion);
router.post('/:id/answer', verifyToken, submitRewardQuestionAnswer);
router.post('/submit-answer', verifyToken, submitRewardQuestionAnswer);

export default router; 