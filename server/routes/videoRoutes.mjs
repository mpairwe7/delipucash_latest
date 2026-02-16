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
  getVideoStatus,
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
import jwt from 'jsonwebtoken';

const router = express.Router();

// Optional auth — verifies token if present, continues anonymously if not
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return next();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.userRef = decoded.id;
  } catch {
    // Invalid token — continue as anonymous
  }
  next();
};

// ============================================================================
// PUBLIC ROUTES (read-only)
// ============================================================================

router.get('/all', optionalAuth, getAllVideos);
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
router.get('/:id/status', verifyToken, getVideoStatus);
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