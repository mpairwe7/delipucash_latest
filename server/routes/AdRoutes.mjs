import express from 'express';
import {
  getAllAds,
  createAd,
  updateAd,
  deleteAd,
  trackAdView,
  trackAdClick,
  trackAdInteraction
} from '../controllers/AdController.mjs';

const router = express.Router();

// Get all ads (matches frontend: GET /ads/all)
router.get('/all', getAllAds);

// Create a new ad (matches frontend: POST /ads/create)
router.post('/create', createAd);

// Update an ad (matches frontend: PUT /ads/:adId/update)
router.put('/:adId/update', updateAd);

// Delete an ad (matches frontend: DELETE /ads/:adId/delete)
router.delete('/:adId/delete', deleteAd);

// Track ad view (matches frontend: POST /ads/:adId/view)
router.post('/:adId/view', trackAdView);

// Track ad click (matches frontend: POST /ads/:adId/click)
router.post('/:adId/click', trackAdClick);

// Track ad interaction (matches frontend: POST /ads/:adId/interaction)
router.post('/:adId/interaction', trackAdInteraction);

export default router;