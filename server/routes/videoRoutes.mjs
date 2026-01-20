import express from 'express';
import {
  createVideo,
  getVideosByUser,
  getAllVideos,
  updateVideo,
  deleteVideo,
  likeVideo,
  commentPost,
  bookmarkVideo,
  incrementVideoViews
} from '../controllers/videoController.mjs';

const router = express.Router();

// Route to create a new video
router.post('/create', createVideo);

// Route to get videos uploaded by a specific user
router.get('/user/:userId', getVideosByUser);

// Route to get all videos (public endpoint)
router.get('/all', getAllVideos);

// Route to like video
router.post('/:id/like', likeVideo);

// Route to post comments
router.post('/:id/comments', commentPost);

// Route to bookmark video
router.post('/:id/bookmark', bookmarkVideo);

// Route to increment video views
router.post('/:id/views', incrementVideoViews);

// Route to update video details
router.put('/update/:id', updateVideo);

// Route to delete a video
router.delete('/delete/:id', deleteVideo);

export default router;