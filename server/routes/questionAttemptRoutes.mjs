import express from 'express';
import { recordAttempt, getAttemptsByUser } from '../controllers/questionAttemptController.mjs';

const router = express.Router();

// Route to record a question attempt
router.post('/record', recordAttempt);

// Route to get attempts by a specific user
router.get('/:phoneNumber', getAttemptsByUser);

export default router;
