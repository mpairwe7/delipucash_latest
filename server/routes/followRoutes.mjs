import express from 'express';
import {
  followCreator,
  unfollowCreator,
  getFollowStatus,
  getFollowCounts,
  getFollowers,
  getFollowing,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from '../controllers/followController.mjs';
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
// FOLLOW ROUTES — Named routes BEFORE parameterized routes
// ============================================================================

// Block management (named route first to avoid /:userId collision)
router.get('/blocked', verifyToken, getBlockedUsers);

// Follow/unfollow actions
router.post('/:creatorId/follow', verifyToken, followCreator);
router.delete('/:creatorId/unfollow', verifyToken, unfollowCreator);
router.get('/:creatorId/status', verifyToken, getFollowStatus);

// Block/unblock actions
router.post('/:userId/block', verifyToken, blockUser);
router.delete('/:userId/unblock', verifyToken, unblockUser);

// Public profile data
router.get('/:userId/counts', getFollowCounts);
router.get('/:userId/followers', optionalAuth, getFollowers);
router.get('/:userId/following', optionalAuth, getFollowing);

export default router;
