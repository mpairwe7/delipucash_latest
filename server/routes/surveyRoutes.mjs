import express from 'express';
import { createSurvey, getSurveysByStatus, uploadSurvey, submitSurveyResponse, getSurveyById, getSurveyResponses, checkSurveyAttempt, getAllSurveys, updateSurvey, deleteSurvey, getSurveyAnalytics } from '../controllers/surveyController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Optional auth — sets req.user if a valid token is present, proceeds otherwise
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch {
    // Invalid token — continue without user context
  }
  next();
};

// Public routes (read-only, optionalAuth for personalization)
router.get('/all', optionalAuth, getAllSurveys);
router.get('/status/:status', optionalAuth, getSurveysByStatus);
router.get('/:surveyId', optionalAuth, getSurveyById);

// Protected routes (require authentication)
router.get('/:surveyId/attempt', verifyToken, checkSurveyAttempt);
router.get('/:surveyId/responses', verifyToken, getSurveyResponses);
router.get('/:surveyId/analytics', verifyToken, getSurveyAnalytics);
router.post('/create', verifyToken, createSurvey);
router.post('/upload', verifyToken, uploadSurvey);
router.post('/:surveyId/responses', verifyToken, submitSurveyResponse);
router.put('/:surveyId', verifyToken, updateSurvey);
router.delete('/:surveyId', verifyToken, deleteSurvey);

export default router;
