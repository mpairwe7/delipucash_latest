import express from 'express';
import rateLimit from 'express-rate-limit';
import { addReward, getRewardsByUser, getRewardsByUserId, redeemRewards, getDailyRewardStatus, claimDailyReward } from '../controllers/rewardController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

/** Redemption: 3 requests per minute per IP */
const redeemLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many redemption requests. Please try again in a minute.' },
});

// Static/prefixed routes FIRST to prevent /:phoneNumber from swallowing them
router.get('/daily', verifyToken, getDailyRewardStatus);
router.post('/daily', verifyToken, claimDailyReward);
router.get('/user/:userId', verifyToken, getRewardsByUserId);
router.post('/add', verifyToken, addReward);
router.post('/redeem', redeemLimiter, verifyToken, redeemRewards);
router.get('/:phoneNumber', verifyToken, getRewardsByUser);

export default router;
