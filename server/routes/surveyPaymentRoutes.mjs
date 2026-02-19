/**
 * Survey Payment Routes
 * 
 * Routes for survey payment processing.
 * 
 * @module routes/surveyPaymentRoutes
 */

import express from 'express';
import {
  initiatePayment,
  checkPaymentStatus,
  getPaymentHistory,
  getUnifiedSubscriptionStatus,
  cleanupStalePayments,
} from '../controllers/surveyPaymentController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// ============================================================================
// PAYMENT ROUTES (all protected)
// ============================================================================

/**
 * @route   POST /api/survey-payments/initiate
 * @desc    Initiate a new payment for survey subscription
 * @access  Private
 */
router.post('/initiate', verifyToken, initiatePayment);

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
 * @access  Private (admin/cron)
 */
router.post('/cleanup-stale', verifyToken, cleanupStalePayments);

/**
 * @route   GET /api/survey-payments/:paymentId/status
 * @desc    Check specific payment status
 * @access  Private
 */
router.get('/:paymentId/status', verifyToken, checkPaymentStatus);

export default router;
