import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  addReward,
  getRewardsByUser,
  getRewardsByUserId,
  redeemRewards,
  getDailyRewardStatus,
  claimDailyReward,
  sendPhoneVerificationCode,
  verifyPhone,
} from '../controllers/rewardController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';
import { requireIntegrity, generateIntegrityNonce } from '../lib/playIntegrity.mjs';

const router = express.Router();

/** Redemption: 3 requests per minute per IP */
const redeemLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many redemption requests. Please try again in a minute.' },
});

/** OTP send: 60-second cooldown to mitigate email spam */
const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait a minute before requesting another code.' },
});

// Static/prefixed routes FIRST to prevent /:phoneNumber from swallowing them
router.get('/daily', verifyToken, getDailyRewardStatus);
router.post('/daily', verifyToken, claimDailyReward);
router.get('/user/:userId', verifyToken, getRewardsByUserId);
router.post('/add', verifyToken, addReward);

// Play Integrity nonce — client requests this immediately before redemption
// and includes the resulting integrity token in the redeem call.
router.get('/integrity-nonce', verifyToken, async (req, res) => {
  res.json({ nonce: await generateIntegrityNonce() });
});

// MoMo phone verification (gates first-time withdrawals to a new MSISDN)
router.post('/verify-phone-send', verifyToken, otpSendLimiter, sendPhoneVerificationCode);
router.post('/verify-phone', verifyToken, verifyPhone);

// Redemption: rate-limit + JWT + Play Integrity (Android) before the controller.
router.post('/redeem', redeemLimiter, verifyToken, requireIntegrity(), redeemRewards);

router.get('/:phoneNumber', verifyToken, getRewardsByUser);

export default router;
