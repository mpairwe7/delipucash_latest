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
import { verifyToken, requireModerator } from '../utils/verifyUser.mjs';

const router = express.Router();

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
router.post('/:id/answer', verifyToken, submitRewardQuestionAnswer);
router.post('/submit-answer', verifyToken, submitRewardQuestionAnswer);

export default router; 