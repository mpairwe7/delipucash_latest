import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { publishEvent } from '../lib/eventBus.mjs';

// ============================================================================
// FOLLOW CREATOR — Creates explicit follow + increments denormalized counters
// POST /api/follows/:creatorId/follow
// ============================================================================

export const followCreator = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { creatorId } = req.params;

  if (userId === creatorId) {
    return res.status(400).json({ message: 'Cannot follow yourself' });
  }

  // Verify creator exists
  const creator = await prisma.appUser.findUnique({
    where: { id: creatorId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!creator) {
    return res.status(404).json({ message: 'Creator not found' });
  }

  // Check if blocked
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: creatorId },
        { blockerId: creatorId, blockedId: userId },
      ],
    },
  });
  if (block) {
    return res.status(403).json({ message: 'Cannot follow a blocked user' });
  }

  // Idempotent: check if already following
  const existing = await prisma.creatorFollow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId: creatorId } },
  });
  if (existing) {
    return res.status(200).json({
      success: true,
      message: 'Already following',
      data: { isFollowing: true, followId: existing.id },
    });
  }

  // Create follow + increment counters atomically
  const [follow] = await prisma.$transaction([
    prisma.creatorFollow.create({
      data: { followerId: userId, followingId: creatorId },
    }),
    prisma.appUser.update({
      where: { id: userId },
      data: { followingCount: { increment: 1 } },
    }),
    prisma.appUser.update({
      where: { id: creatorId },
      data: { followersCount: { increment: 1 } },
    }),
  ]);

  // SSE: Notify creator of new follower
  publishEvent(creatorId, 'creator.new_follower', {
    followerId: userId,
    followId: follow.id,
  }).catch(() => {});

  res.status(201).json({
    success: true,
    message: 'Followed successfully',
    data: { isFollowing: true, followId: follow.id },
  });
});

// ============================================================================
// UNFOLLOW CREATOR — Removes follow + decrements counters
// DELETE /api/follows/:creatorId/unfollow
// ============================================================================

export const unfollowCreator = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { creatorId } = req.params;

  const existing = await prisma.creatorFollow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId: creatorId } },
  });

  if (!existing) {
    return res.status(200).json({
      success: true,
      message: 'Not following',
      data: { isFollowing: false },
    });
  }

  await prisma.$transaction([
    prisma.creatorFollow.delete({
      where: { followerId_followingId: { followerId: userId, followingId: creatorId } },
    }),
    prisma.appUser.update({
      where: { id: userId },
      data: { followingCount: { decrement: 1 } },
    }),
    prisma.appUser.update({
      where: { id: creatorId },
      data: { followersCount: { decrement: 1 } },
    }),
  ]);

  res.json({
    success: true,
    message: 'Unfollowed successfully',
    data: { isFollowing: false },
  });
});

// ============================================================================
// GET FOLLOW STATUS — Check if current user follows a creator
// GET /api/follows/:creatorId/status
// ============================================================================

export const getFollowStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { creatorId } = req.params;

  const follow = await prisma.creatorFollow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId: creatorId } },
  });

  res.json({
    success: true,
    data: {
      isFollowing: !!follow,
      notificationsEnabled: follow?.notificationsEnabled ?? false,
    },
  });
});

// ============================================================================
// GET FOLLOW COUNTS — Public follower/following counts
// GET /api/follows/:userId/counts
// ============================================================================

export const getFollowCounts = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { followersCount: true, followingCount: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    success: true,
    data: {
      followersCount: user.followersCount,
      followingCount: user.followingCount,
    },
  });
});

// ============================================================================
// GET FOLLOWERS — Paginated list of users who follow a given user
// GET /api/follows/:userId/followers
// ============================================================================

export const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const authUserId = req.user?.id;

  const [followers, total] = await Promise.all([
    prisma.creatorFollow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.creatorFollow.count({ where: { followingId: userId } }),
  ]);

  // If authed, check which of these followers the current user also follows
  let followingSet = new Set();
  if (authUserId) {
    const myFollowing = await prisma.creatorFollow.findMany({
      where: {
        followerId: authUserId,
        followingId: { in: followers.map(f => f.followerId) },
      },
      select: { followingId: true },
    });
    followingSet = new Set(myFollowing.map(f => f.followingId));
  }

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: followers.map(f => ({
      id: f.follower.id,
      firstName: f.follower.firstName,
      lastName: f.follower.lastName,
      avatar: f.follower.avatar,
      isFollowing: followingSet.has(f.followerId),
      followedAt: f.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
  });
});

// ============================================================================
// GET FOLLOWING — Paginated list of users a given user follows
// GET /api/follows/:userId/following
// ============================================================================

export const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const authUserId = req.user?.id;

  const [following, total] = await Promise.all([
    prisma.creatorFollow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.creatorFollow.count({ where: { followerId: userId } }),
  ]);

  // If authed, check which the current user also follows
  let followingSet = new Set();
  if (authUserId) {
    const myFollowing = await prisma.creatorFollow.findMany({
      where: {
        followerId: authUserId,
        followingId: { in: following.map(f => f.followingId) },
      },
      select: { followingId: true },
    });
    followingSet = new Set(myFollowing.map(f => f.followingId));
  }

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: following.map(f => ({
      id: f.following.id,
      firstName: f.following.firstName,
      lastName: f.following.lastName,
      avatar: f.following.avatar,
      isFollowing: authUserId === userId ? true : followingSet.has(f.followingId),
      followedAt: f.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
  });
});

// ============================================================================
// BLOCK USER — Creates block + auto-unfollows both directions
// POST /api/follows/:userId/block
// ============================================================================

export const blockUser = asyncHandler(async (req, res) => {
  const blockerId = req.user.id;
  const { userId: blockedId } = req.params;

  if (blockerId === blockedId) {
    return res.status(400).json({ message: 'Cannot block yourself' });
  }

  // Check if already blocked
  const existing = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (existing) {
    return res.status(200).json({ success: true, message: 'Already blocked' });
  }

  // Block + remove follows in both directions atomically
  const operations = [
    prisma.userBlock.create({ data: { blockerId, blockedId } }),
  ];

  // Remove follow: blocker -> blocked
  const followA = await prisma.creatorFollow.findUnique({
    where: { followerId_followingId: { followerId: blockerId, followingId: blockedId } },
  });
  if (followA) {
    operations.push(
      prisma.creatorFollow.delete({ where: { id: followA.id } }),
      prisma.appUser.update({ where: { id: blockerId }, data: { followingCount: { decrement: 1 } } }),
      prisma.appUser.update({ where: { id: blockedId }, data: { followersCount: { decrement: 1 } } }),
    );
  }

  // Remove follow: blocked -> blocker
  const followB = await prisma.creatorFollow.findUnique({
    where: { followerId_followingId: { followerId: blockedId, followingId: blockerId } },
  });
  if (followB) {
    operations.push(
      prisma.creatorFollow.delete({ where: { id: followB.id } }),
      prisma.appUser.update({ where: { id: blockedId }, data: { followingCount: { decrement: 1 } } }),
      prisma.appUser.update({ where: { id: blockerId }, data: { followersCount: { decrement: 1 } } }),
    );
  }

  await prisma.$transaction(operations);

  res.json({ success: true, message: 'User blocked' });
});

// ============================================================================
// UNBLOCK USER
// DELETE /api/follows/:userId/unblock
// ============================================================================

export const unblockUser = asyncHandler(async (req, res) => {
  const blockerId = req.user.id;
  const { userId: blockedId } = req.params;

  const existing = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });

  if (!existing) {
    return res.status(200).json({ success: true, message: 'Not blocked' });
  }

  await prisma.userBlock.delete({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });

  res.json({ success: true, message: 'User unblocked' });
});

// ============================================================================
// GET BLOCKED USERS — Paginated list
// GET /api/follows/blocked
// ============================================================================

export const getBlockedUsers = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [blocks, total] = await Promise.all([
    prisma.userBlock.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.userBlock.count({ where: { blockerId: userId } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: blocks.map(b => ({
      id: b.blocked.id,
      firstName: b.blocked.firstName,
      lastName: b.blocked.lastName,
      avatar: b.blocked.avatar,
      blockedAt: b.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
  });
});
