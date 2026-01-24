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
} from '../controllers/videoController.mjs';

const router = express.Router();

// ============================================================================
// VIDEO CRUD ROUTES
// ============================================================================

// Route to create a new video
router.post('/create', createVideo);

// Route to get videos uploaded by a specific user
router.get('/user/:userId', getVideosByUser);

// Route to get all videos (public endpoint)
router.get('/all', getAllVideos);

// Route to like video
router.post('/:id/like', likeVideo);

// Route to unlike video
router.post('/:id/unlike', unlikeVideo);

// Route to post comments
router.post('/:id/comments', commentPost);

// Route to get video comments
router.get('/:id/comments', getVideoComments);

// Route to share video (track share action)
router.post('/:id/share', shareVideo);

// Route to bookmark video
router.post('/:id/bookmark', bookmarkVideo);

// Route to increment video views
router.post('/:id/views', incrementVideoViews);

// Route to update video details
router.put('/update/:id', updateVideo);

// Route to delete a video
router.delete('/delete/:id', deleteVideo);

// ============================================================================
// VIDEO PREMIUM & LIMITS ROUTES
// ============================================================================

// Get user's video premium status and limits
router.get('/limits/:userId', getVideoLimits);

// Validate upload request before uploading (check file size against user's limit)
router.post('/validate-upload', validateUpload);

// Start a livestream session
router.post('/livestream/start', startLivestream);

// End a livestream session
router.post('/livestream/end', endLivestream);

// Validate session duration (for recording or livestream)
router.post('/validate-session', validateSessionDuration);

export default router;