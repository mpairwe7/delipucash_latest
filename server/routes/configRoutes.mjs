import express from 'express';
import { getRewardConfig, updateRewardConfig } from '../controllers/configController.mjs';
import { verifyToken, requireModerator } from '../utils/verifyUser.mjs';

const router = express.Router();

// Public — any client can read reward config
router.get('/rewards', getRewardConfig);

// Protected — only admin/moderator can update
router.put('/rewards', verifyToken, requireModerator, updateRewardConfig);

export default router;
