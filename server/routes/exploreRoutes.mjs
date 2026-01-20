import express from 'express';
import { getExploreItems } from '../controllers/exploreController.mjs';

const router = express.Router();

router.get('/items', getExploreItems);

export default router; 