import express from 'express';
import { 
  likeResponse, 
  dislikeResponse, 
  submitReply, 
  getRepliesForResponse,
  getResponseWithCounts 
} from '../controllers/responseController.mjs';

const router = express.Router();

// Like/Unlike a response
router.post('/:responseId/like', likeResponse);

// Dislike/Remove dislike from a response
router.post('/:responseId/dislike', dislikeResponse);

// Submit a reply to a response
router.post('/:responseId/replies', submitReply);

// Get all replies for a response
router.get('/:responseId/replies', getRepliesForResponse);

// Get response with counts and user status
router.get('/:responseId', getResponseWithCounts);

export default router;