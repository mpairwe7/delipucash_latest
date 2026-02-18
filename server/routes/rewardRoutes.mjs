import express from 'express';
import { addReward, getRewardsByUser, getRewardsByUserId, redeemRewards } from '../controllers/rewardController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// Static/prefixed routes FIRST to prevent /:phoneNumber from swallowing them
router.get('/user/:userId', verifyToken, getRewardsByUserId);
router.post('/add', verifyToken, addReward);
router.post('/redeem', verifyToken, redeemRewards);
router.get('/:phoneNumber', verifyToken, getRewardsByUser);

export default router;
