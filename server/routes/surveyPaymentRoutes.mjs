/**
 * Survey Payment Routes
 *
 * Routes for survey payment processing.
 *
 * @module routes/surveyPaymentRoutes
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  initiatePayment,
  checkPaymentStatus,
  getPaymentHistory,
  getUnifiedSubscriptionStatus,
  cleanupStalePayments,
} from '../controllers/surveyPaymentController.mjs';
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

/** Status polling: 30 requests per minute per IP (frontend polls every 3s) */
const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many status requests. Please slow down.' },
});

// ============================================================================
// PAYMENT ROUTES (all protected)
// ============================================================================

/**
 * @route   POST /api/survey-payments/initiate
 * @desc    Initiate a new payment for survey subscription
 * @access  Private
 */
router.post('/initiate', initiateLimiter, verifyToken, initiatePayment);

/**
 * @route   GET /api/survey-payments/history
 * @desc    Get payment history for current user
 * @access  Private
 */
router.get('/history', verifyToken, getPaymentHistory);

/**
 * @route   GET /api/survey-payments/unified-status
 * @desc    Get unified subscription status (MoMo + Google Play)
 * @access  Private
 */
router.get('/unified-status', verifyToken, getUnifiedSubscriptionStatus);

/**
 * @route   POST /api/survey-payments/cleanup-stale
 * @desc    Mark stale PENDING payments (>15 min) as FAILED
 * @access  Admin only
 */
router.post('/cleanup-stale', verifyToken, requireAdmin, cleanupStalePayments);

/**
 * @route   GET /api/survey-payments/:paymentId/status
 * @desc    Check specific payment status
 * @access  Private
 */
router.get('/:paymentId/status', statusLimiter, verifyToken, checkPaymentStatus);

export default router;
