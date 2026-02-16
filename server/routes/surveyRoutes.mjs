import express from 'express';
import { createSurvey, getSurveysByStatus, uploadSurvey, submitSurveyResponse, getSurveyById, getSurveyResponses, checkSurveyAttempt, getAllSurveys, updateSurvey, deleteSurvey, getSurveyAnalytics } from '../controllers/surveyController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// Public routes (read-only)
router.get('/all', getAllSurveys);
router.get('/status/:status', getSurveysByStatus);
router.get('/:surveyId/attempt', checkSurveyAttempt);
router.get('/:surveyId/responses', verifyToken, getSurveyResponses);
router.get('/:surveyId/analytics', verifyToken, getSurveyAnalytics);
router.get('/:surveyId', getSurveyById);

// Protected routes (require authentication)
router.post('/create', verifyToken, createSurvey);
router.post('/upload', verifyToken, uploadSurvey);
router.post('/:surveyId/responses', verifyToken, submitSurveyResponse);
router.put('/:surveyId', verifyToken, updateSurvey);
router.delete('/:surveyId', verifyToken, deleteSurvey);

export default router;
