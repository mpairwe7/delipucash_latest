import express from 'express';
import { createSurvey, getSurveysByStatus, uploadSurvey, submitSurveyResponse, getSurveyById, getSurveyResponses, checkSurveyAttempt, getAllSurveys, updateSurvey, deleteSurvey } from '../controllers/surveyController.mjs';

const router = express.Router();

// Route to get all surveys (with optional status filter)
router.get('/all', getAllSurveys);

// Route to create a new survey
router.post('/create', createSurvey);
router.post('/upload', uploadSurvey);

router.get('/status/:status', getSurveysByStatus);

// Check if user has already attempted the survey (single attempt enforcement)
router.get('/:surveyId/attempt', checkSurveyAttempt);

// Survey responses: submit and retrieve
router.post('/:surveyId/responses', submitSurveyResponse);
router.get('/:surveyId/responses', getSurveyResponses);

router.get('/:surveyId', getSurveyById);
router.put('/:surveyId', updateSurvey);
router.delete('/:surveyId', deleteSurvey);

export default router;
