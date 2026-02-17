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
 * @route   GET /api/survey-payments/:paymentId/status
 * @desc    Check specific payment status
 * @access  Private
 */
router.get('/:paymentId/status', verifyToken, checkPaymentStatus);

export default router;
