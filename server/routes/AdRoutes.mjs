import express from 'express';
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
// PUBLIC ROUTES
// ============================================================================

// Get all ads (with optional filtering)
// Query params: type, placement, status, sponsored, userId, limit, offset
router.get('/all', getAllAds);

// Get ads by user
router.get('/user/:userId', getAdsByUser);

// Create a new ad
router.post('/create', createAd);

// ============================================================================
// AD MANAGEMENT ROUTES
// ============================================================================

// Update an ad
router.put('/:adId/update', updateAd);

// Delete an ad
router.delete('/:adId/delete', deleteAd);

// Get ad analytics/performance
router.get('/:adId/analytics', getAdAnalytics);

// Pause ad campaign
router.put('/:adId/pause', pauseAd);

// Resume ad campaign
router.put('/:adId/resume', resumeAd);

// ============================================================================
// ADMIN ROUTES (should be protected with admin middleware)
// ============================================================================

// Get pending ads for review
router.get('/admin/pending', getPendingAds);

// Approve an ad
router.put('/:adId/approve', approveAd);

// Reject an ad
router.put('/:adId/reject', rejectAd);

// ============================================================================
// TRACKING ROUTES
// ============================================================================

// Track ad view
router.post('/:adId/view', trackAdView);

// Track ad impression (with CPM budget deduction)
router.post('/:adId/impression', trackAdImpression);

// Track ad click (with CPC budget deduction)
router.post('/:adId/click', trackAdClick);

// Track conversion (with CPA budget deduction)
router.post('/:adId/conversion', trackAdConversion);

export default router;