import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../utils/verifyUser.mjs';
import { sseStream, ssePoll, sseHealth } from '../controllers/sseController.mjs';

const router = express.Router();

/**
 * Canonical real-time endpoints (2026 best practice).
 *
 * GET /api/realtime/sse          — SSE stream (push via LISTEN/NOTIFY)
 * GET /api/realtime/poll         — JSON poll fallback
 * GET /api/realtime/health       — Real-time subsystem health
 *
 * The legacy /api/sse/* routes still work and share the same controller.
 */

// Rate limiter for SSE stream — prevents reconnection storms.
// 30 connections per minute per IP. SSE reconnects every ~25s (TTL),
// so a single client makes ~2.4 requests/min. 30 allows multiple
// tabs/devices from the same IP with headroom.
const sseLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many SSE connections, please try again later' },
});

// Rate limiter for poll endpoint — 60 requests per minute per IP
const pollLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many poll requests, please try again later' },
});

// SSE stream — real-time push via PostgreSQL LISTEN/NOTIFY
router.get('/sse', sseLimiter, verifyToken, sseStream);

// JSON poll — for edge functions or RN background fetch
router.get('/poll', pollLimiter, verifyToken, ssePoll);

// Health check (public)
router.get('/health', sseHealth);

export default router;
