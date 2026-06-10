import express from 'express';
import { verifyToken, requireModerator, softAuth } from '../utils/verifyUser.mjs';
import { adTrackingRateLimit } from '../utils/adRateLimit.mjs';
import {
  getAllAds,
  getAdsByUser,
  createAd,
  updateAd,
  deleteAd,
  trackAdView,
  trackAdClick,
  trackAdImpression,
  trackAdConversion,
  approveAd,
  rejectAd,
  pauseAd,
  resumeAd,
  getPendingAds,
  getAdAnalytics
} from '../controllers/AdController.mjs';

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (no auth required — consumed by app feed)
// ============================================================================

// Get all ads (with optional filtering)
// Query params: type, placement, status, sponsored, userId, limit, offset
router.get('/all', getAllAds);

// Get ads by user
router.get('/user/:userId', getAdsByUser);

// Create a new ad (auth required — userId comes from JWT)
router.post('/create', verifyToken, createAd);

// ============================================================================
// AD MANAGEMENT ROUTES (auth required — owner or admin)
// ============================================================================

// Update an ad
router.put('/:adId/update', verifyToken, updateAd);

// Delete an ad
router.delete('/:adId/delete', verifyToken, deleteAd);

// Get ad analytics/performance
router.get('/:adId/analytics', verifyToken, getAdAnalytics);

// Pause ad campaign
router.put('/:adId/pause', verifyToken, pauseAd);

// Resume ad campaign
router.put('/:adId/resume', verifyToken, resumeAd);

// ============================================================================
// ADMIN ROUTES (auth + admin/moderator role required)
// ============================================================================

// Get pending ads for review
router.get('/admin/pending', verifyToken, requireModerator, getPendingAds);

// Approve an ad
router.put('/:adId/approve', verifyToken, requireModerator, approveAd);

// Reject an ad
router.put('/:adId/reject', verifyToken, requireModerator, rejectAd);

// ============================================================================
// TRACKING ROUTES (public, but rate-limited + soft-authed)
//
// These deduct advertiser budget, so each is rate-limited (per-IP) and runs softAuth
// to attribute to a real user when a token is present (anonymous still allowed). The
// controller validates the ad is servable and spends budget atomically.
// ============================================================================

// Track ad view
router.post('/:adId/view', adTrackingRateLimit, softAuth, trackAdView);

// Track ad impression (with CPM budget deduction)
router.post('/:adId/impression', adTrackingRateLimit, softAuth, trackAdImpression);

// Track ad click (with CPC budget deduction)
router.post('/:adId/click', adTrackingRateLimit, softAuth, trackAdClick);

// Track conversion (with CPA budget deduction)
router.post('/:adId/conversion', adTrackingRateLimit, softAuth, trackAdConversion);

export default router;