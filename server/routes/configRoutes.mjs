import express from 'express';
import { getRewardConfig, updateRewardConfig, getSubscriptionPriceConfig, updateSubscriptionPriceConfig } from '../controllers/configController.mjs';
import { verifyToken, requireModerator } from '../utils/verifyUser.mjs';

const router = express.Router();

// Public — any client can read reward config
router.get('/rewards', getRewardConfig);

// Protected — only admin/moderator can update
router.put('/rewards', verifyToken, requireModerator, updateRewardConfig);

// Subscription pricing — public read, moderator-only write
router.get('/subscriptions', getSubscriptionPriceConfig);
router.put('/subscriptions', verifyToken, requireModerator, updateSubscriptionPriceConfig);

export default router;
