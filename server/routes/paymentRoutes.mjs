import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  initiatePayment,
  handleCallback,
  getPaymentHistory,
  updatePaymentStatus,
  initiateDisbursement,
} from '../controllers/paymentController.mjs';
import { redeemRewards } from '../controllers/rewardController.mjs';
import { verifyToken, requireAdmin } from '../utils/verifyUser.mjs';

const router = express.Router();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/** Payment initiation: 5 requests per minute per IP */
const initiateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please try again in a minute.' },
});

/** Withdrawal / redemption: 3 requests per minute per IP */
const withdrawLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many withdrawal requests. Please try again in a minute.' },
});

/** Callback endpoint: 30 requests per minute per IP (providers may batch) */
const callbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many callback requests.' },
});

// All payment routes require authentication (except callback)
router.post('/initiate', initiateLimiter, verifyToken, initiatePayment);
router.post('/disburse', initiateLimiter, verifyToken, requireAdmin, initiateDisbursement);
router.post('/callback', callbackLimiter, handleCallback); // Callback uses HMAC signature verification (not JWT)
router.get("/users/:userId/payments", verifyToken, getPaymentHistory);
router.put("/payments/:paymentId/status", verifyToken, requireAdmin, updatePaymentStatus);

// Withdrawal proxy — frontend's /api/payments/withdraw → same handler as /api/rewards/redeem
router.post('/withdraw', withdrawLimiter, verifyToken, redeemRewards);

export default router;
