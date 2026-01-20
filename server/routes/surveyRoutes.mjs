import express from 'express';
import { createSurvey,   getSurveysByStatus, uploadSurvey ,submitSurveyResponse ,getSurveyById} from '../controllers/surveyController.mjs';

const router = express.Router();

// Route to create a new survey
router.post('/create', createSurvey);
router.post('/upload', uploadSurvey);

router.get('/status/:status', getSurveysByStatus);// Add the new route
router.post('/:surveyId/responses', submitSurveyResponse);
router.get('/:surveyId', getSurveyById);

export default router;
