import express from 'express';
import { createQuestion, getQuestions, uploadQuestions, createResponse, getResponsesForQuestion, getUploadedQuestions, voteQuestion, getQuestionById } from '../controllers/questionController.mjs';

const router = express.Router();

// Route to create a new question
router.post('/create', createQuestion);





// Route to get all questions
router.get('/all', getQuestions);

router.get('/uploaded', getUploadedQuestions);


router.post('/loadquestions',  uploadQuestions);

router.post("/:questionId/vote", voteQuestion);
router.post("/:questionId/responses", createResponse);
router.get("/:questionId/responses", getResponsesForQuestion);
router.get("/:questionId", getQuestionById);

export default router;
