import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../utils/verifyUser.mjs';
import { sseStream, ssePoll, sseHealth } from '../controllers/sseController.mjs';

const router = express.Router();

/**
 * Legacy SSE routes (kept for backward compatibility).
 * Canonical routes are at /api/realtime/*.
 */

// Rate limiter for SSE stream — prevents reconnection storms
const sseLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many SSE connections, please try again later' },
});

// Rate limiter for poll endpoint
const pollLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many poll requests, please try again later' },
});

// SSE stream endpoint — requires JWT authentication
// Supports: ?topics=notification.new,payment.status  (optional filter)
// Supports: Last-Event-ID header for resumption
router.get('/stream', sseLimiter, verifyToken, sseStream);

// Lightweight JSON poll — used by edge function or RN background
// Supports: ?lastSeq=0&topics=notification.new  (optional filter)
router.get('/poll', pollLimiter, verifyToken, ssePoll);

// Health/metrics for the real-time subsystem (public)
router.get('/health', sseHealth);

export default router;
