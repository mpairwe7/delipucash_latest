import express from 'express';
import { createSurvey, getSurveysByStatus, uploadSurvey, submitSurveyResponse, getSurveyById, checkSurveyAttempt } from '../controllers/surveyController.mjs';

const router = express.Router();

// Route to create a new survey
router.post('/create', createSurvey);
router.post('/upload', uploadSurvey);

router.get('/status/:status', getSurveysByStatus);

// Check if user has already attempted the survey (single attempt enforcement)
router.get('/:surveyId/attempt', checkSurveyAttempt);

// Submit survey response
router.post('/:surveyId/responses', submitSurveyResponse);
router.get('/:surveyId', getSurveyById);

export default router;
