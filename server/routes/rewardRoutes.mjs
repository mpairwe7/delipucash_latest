import express from 'express';
import { addReward, getRewardsByUser, getRewardsByUserId } from '../controllers/rewardController.mjs';

const router = express.Router();

// Route to add reward points
router.post('/add', addReward);

// Route to get rewards for a specific user by phone number
router.get('/:phoneNumber', getRewardsByUser);

// Route to get rewards for a specific user by user ID
router.get('/user/:userId', getRewardsByUserId);

export default router;
