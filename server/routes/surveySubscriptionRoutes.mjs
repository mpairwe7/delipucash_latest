/**
 * Survey Payment Routes
 * 
 * Routes for survey subscription payments and management.
 * 
 * @module routes/surveyPaymentRoutes
 */

import express from 'express';
import {
  getPlans,
  getSubscriptionStatus,
  initiatePayment,
  checkPaymentStatus,
  getPaymentHistory,
  cancelSubscription,
} from '../controllers/surveyPaymentController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

/**
 * @route   GET /api/survey-subscriptions/plans
 * @desc    Get all available subscription plans
 * @access  Public
 */
router.get('/plans', getPlans);

/**
 * @route   GET /api/survey-subscriptions/status
 * @desc    Get current user's subscription status
 * @access  Private
 */
router.get('/status', verifyToken, getSubscriptionStatus);

/**
 * @route   POST /api/survey-subscriptions/:subscriptionId/cancel
 * @desc    Cancel subscription auto-renewal
 * @access  Private
 */
router.post('/:subscriptionId/cancel', verifyToken, cancelSubscription);

export default router;
