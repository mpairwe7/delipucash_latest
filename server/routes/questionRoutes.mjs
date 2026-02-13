import express from 'express';
import { createQuestion, getQuestions, uploadQuestions, createResponse, getResponsesForQuestion, getUploadedQuestions, voteQuestion, getQuestionById, getLeaderboard, getUserQuestionStats } from '../controllers/questionController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// Public routes (read-only)
router.get('/leaderboard', getLeaderboard);
router.get('/user-stats', getUserQuestionStats);
router.get('/all', getQuestions);
router.get('/uploaded', getUploadedQuestions);
router.get("/:questionId/responses", getResponsesForQuestion);
router.get("/:questionId", getQuestionById);

// Protected routes (require authentication)
router.post('/create', verifyToken, createQuestion);
router.post('/loadquestions', verifyToken, uploadQuestions);
router.post("/:questionId/vote", verifyToken, voteQuestion);
router.post("/:questionId/responses", verifyToken, createResponse);

export default router;
