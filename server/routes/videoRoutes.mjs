import express from 'express';
import {
  createVideo,
  getVideosByUser,
  getAllVideos,
  updateVideo,
  deleteVideo,
  likeVideo,
  unlikeVideo,
  commentPost,
  getVideoComments,
  bookmarkVideo,
  incrementVideoViews,
  shareVideo,
  // Video premium & limits endpoints
  getVideoLimits,
  validateUpload,
  startLivestream,
  endLivestream,
  validateSessionDuration,
  // Livestream endpoints
  getLiveStreams,
  joinLivestream,
  leaveLivestream,
  sendLivestreamChat,
} from '../controllers/videoController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (read-only)
// ============================================================================

router.get('/all', getAllVideos);
router.get('/live', getLiveStreams);
router.get('/user/:userId', getVideosByUser);
router.get('/:id/comments', getVideoComments);
router.get('/limits/:userId', getVideoLimits);

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

router.post('/create', verifyToken, createVideo);
router.post('/:id/like', verifyToken, likeVideo);
router.post('/:id/unlike', verifyToken, unlikeVideo);
router.post('/:id/comments', verifyToken, commentPost);
router.post('/:id/share', shareVideo); // share tracking is public
router.post('/:id/bookmark', verifyToken, bookmarkVideo);
router.post('/:id/views', incrementVideoViews); // view tracking is public
router.put('/update/:id', verifyToken, updateVideo);
router.delete('/delete/:id', verifyToken, deleteVideo);

// Video premium & limits
router.post('/validate-upload', verifyToken, validateUpload);
router.post('/livestream/start', verifyToken, startLivestream);
router.post('/livestream/end', verifyToken, endLivestream);
router.post('/livestream/:sessionId/join', verifyToken, joinLivestream);
router.post('/livestream/:sessionId/leave', verifyToken, leaveLivestream);
router.post('/livestream/:sessionId/chat', verifyToken, sendLivestreamChat);
router.post('/validate-session', verifyToken, validateSessionDuration);

export default router;