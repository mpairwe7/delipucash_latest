import express from 'express';
import { verifyToken } from '../utils/verifyUser.mjs';
import { sseStream } from '../controllers/sseController.mjs';

const router = express.Router();

// SSE stream endpoint — requires JWT authentication
router.get('/stream', verifyToken, sseStream);

export default router;
