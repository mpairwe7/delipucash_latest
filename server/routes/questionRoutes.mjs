import express from 'express';
import { createQuestion, getQuestions,uploadQuestions ,createResponse, getResponsesForQuestion, getUploadedQuestions} from '../controllers/questionController.mjs';

const router = express.Router();

// Route to create a new question
router.post('/create', createQuestion);





// Route to get all questions
router.get('/all', getQuestions);

router.get('/uploaded', getUploadedQuestions);


router.post('/loadquestions',  uploadQuestions);

router.post("/:questionId/responses", createResponse);
router.get("/:questionId/responses", getResponsesForQuestion);

export default router;
