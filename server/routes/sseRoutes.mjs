import express from 'express';
import { verifyToken } from '../utils/verifyUser.mjs';
import { sseStream, ssePoll } from '../controllers/sseController.mjs';

const router = express.Router();

// SSE stream endpoint — requires JWT authentication
router.get('/stream', verifyToken, sseStream);

// Lightweight JSON poll — used by edge function for SSE bridging
router.get('/poll', verifyToken, ssePoll);

export default router;
