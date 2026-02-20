import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { publishEvent } from '../lib/eventBus.mjs';
import { getSignedDownloadUrl, URL_EXPIRY } from '../lib/r2.mjs';

/**
 * Replace public R2 URLs with signed download URLs.
 * Falls back to the stored URL if no R2 key exists (e.g. legacy videos).
 */
async function signVideoUrls(video) {
  const [videoUrl, thumbnail] = await Promise.all([
    video.r2VideoKey
      ? getSignedDownloadUrl(video.r2VideoKey, URL_EXPIRY.DOWNLOAD_URL_EXPIRY)
      : Promise.resolve(video.videoUrl),
    video.r2ThumbnailKey
      ? getSignedDownloadUrl(video.r2ThumbnailKey, URL_EXPIRY.DOWNLOAD_URL_EXPIRY)
      : Promise.resolve(video.thumbnail),
  ]);
  return { videoUrl, thumbnail };
}

// Create a Video
export const createVideo = asyncHandler(async (req, res) => {
  try {
    console.log("Received request data:", req.body);

    const { title, description, videoUrl, thumbnail, duration, timestamp } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!title || !videoUrl || !thumbnail) {
      console.warn("Missing fields:", { title, videoUrl, thumbnail });
      return res.status(400).json({ message: "Title, videoUrl, and thumbnail are required" });
    }

    // Ensure user exists
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.warn("User not found with ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    // Create video record
    const video = await prisma.video.create({
      data: {
        title,
        description: description || "",
        videoUrl,
        thumbnail,
        userId,
        duration: duration ? Math.round(duration) : null, // Duration in seconds
        likes: 0,
        views: 0,
        commentsCount: 0,
        createdAt: timestamp ? new Date(timestamp) : new Date(),
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    console.log("Video created successfully:", video);
    res.status(201).json({ 
      message: "Video created successfully", 
      video: {
        ...video,
        user: {
          id: video.user.id,
          firstName: video.user.firstName,
          lastName: video.user.lastName,
          avatar: video.user.avatar
        }
      }
    });
  } catch (error) {
    console.error("Error creating video:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Post a Comment on a Video
export const commentPost = asyncHandler(async (req, res) => {
  try {
    const { id: videoId } = req.params;
    const { text, media, created_at } = req.body;
    const effectiveUserId = req.user.id;
    console.log("Received request data for comment:", req.body);

    // Validate required fields
    if (!effectiveUserId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!text && (!media || media.length === 0)) {
      return res.status(400).json({ message: "Comment text or media is required" });
    }

    // Verify user exists
    const user = await prisma.appUser.findUnique({
      where: { id: effectiveUserId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const parsedCreatedAt = created_at ? new Date(created_at) : new Date();
    const commentCreatedAt = Number.isNaN(parsedCreatedAt.getTime())
      ? new Date()
      : parsedCreatedAt;

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        text: text || "",
        mediaUrls: media || [],
        userId: effectiveUserId,
        videoId: videoId,
        createdAt: commentCreatedAt,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          },
        },
      },
    });

    // Update video's comment count
    await prisma.video.update({
      where: { id: videoId },
      data: { commentsCount: { increment: 1 } },
    });

    // SSE: Notify video owner of new comment
    if (video.userId !== effectiveUserId) {
      publishEvent(video.userId, 'video.comment', {
        videoId,
        commentId: comment.id,
        commentsCount: video.commentsCount + 1,
      }).catch(() => {});
    }

    res.status(201).json({
      message: "Comment posted successfully",
      comment: {
        id: comment.id,
        text: comment.text,
        mediaUrls: comment.mediaUrls,
        userId: comment.userId,
        videoId: comment.videoId,
        createdAt: comment.createdAt.toISOString(), // ISO string for frontend consistency
        user: {
          id: comment.user.id,
          firstName: comment.user.firstName,
          lastName: comment.user.lastName,
          avatar: comment.user.avatar
        }
      },
    });
    console.log("Comment posted successfully:", comment);
  } catch (error) {
    console.error("Error posting comment:", error);
    res.status(500).json({ message: "Failed to post comment" });
  }
});

// Get Videos Uploaded by a User
export const getVideosByUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch videos for the specified user
    const videos = await prisma.video.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      // Prisma Accelerate: Long-lived cache for user videos (1 hour TTL, 10 min SWR)
    });

    const signedVideos = await Promise.all(videos.map(async (video) => {
      const signed = await signVideoUrls(video);
      return {
        ...video,
        videoUrl: signed.videoUrl,
        thumbnail: signed.thumbnail,
        user: {
          id: video.user.id,
          firstName: video.user.firstName,
          lastName: video.user.lastName,
          avatar: video.user.avatar
        }
      };
    }));

    res.json({
      message: 'Videos fetched successfully',
      videos: signedVideos,
    });
  } catch (error) {
    console.error('Error fetching user videos:', error);
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
});

// Get All Videos (for Streaming or Browsing) — paginated
export const getAllVideos = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const sortBy = req.query.sortBy || 'recent';
    const skip = (page - 1) * limit;

    // Build orderBy based on sortBy param
    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'trending') {
      orderBy = { views: 'desc' };
    } else if (sortBy === 'popular') {
      orderBy = { likes: 'desc' };
    }

    // Optional authenticated user (set by optionalAuth middleware)
    const authUserId = req.user?.id;

    const [videos, total, activeLivestreams, userLikes, userBookmarks] = await Promise.all([
      prisma.video.findMany({
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.video.count(),
      // Fetch active livestream userIds for live badge
      prisma.livestream.findMany({
        where: { status: 'live' },
        select: { userId: true, sessionId: true },
      }),
      // Per-user like status (only if authenticated)
      authUserId
        ? prisma.videoLike.findMany({
            where: { userId: authUserId },
            select: { videoId: true },
          })
        : Promise.resolve([]),
      // Per-user bookmark status (only if authenticated)
      authUserId
        ? prisma.videoBookmark.findMany({
            where: { userId: authUserId },
            select: { videoId: true },
          })
        : Promise.resolve([]),
    ]);

    // Build a map of userId → sessionId for active livestreams
    const liveUserMap = new Map(
      activeLivestreams.map((ls) => [ls.userId, ls.sessionId])
    );
    const likedSet = new Set(userLikes.map(l => l.videoId));
    const bookmarkedSet = new Set(userBookmarks.map(b => b.videoId));

    const formattedVideos = await Promise.all(videos.map(async (video) => {
      const signed = await signVideoUrls(video);
      return {
        id: video.id,
        title: video.title || 'Untitled Video',
        description: video.description || '',
        videoUrl: signed.videoUrl,
        thumbnail: signed.thumbnail,
        userId: video.userId,
        likes: video.likes || 0,
        views: video.views || 0,
        isLiked: likedSet.has(video.id),
        isBookmarked: bookmarkedSet.has(video.id),
        commentsCount: video.commentsCount || 0,
        createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(),
        duration: video.duration || 0,
        comments: [],
        isLive: liveUserMap.has(video.userId),
        livestreamSessionId: liveUserMap.get(video.userId) || null,
        user: video.user ? {
          id: video.user.id,
          firstName: video.user.firstName || 'Anonymous',
          lastName: video.user.lastName || '',
          avatar: video.user.avatar,
        } : null,
      };
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: 'All videos fetched successfully',
      data: formattedVideos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('VideoController: getAllVideos - Error occurred:', error);
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
});

// ============================================================================
// GET SINGLE VIDEO BY ID — returns fresh signed URLs for playback
// Used by the client to refresh expired signed URLs on playback error
// ============================================================================

export const getVideoById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = req.user?.id;

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Per-user like/bookmark status (only if authenticated)
    const [userLike, userBookmark] = await Promise.all([
      authUserId
        ? prisma.videoLike.findFirst({ where: { userId: authUserId, videoId: id } })
        : Promise.resolve(null),
      authUserId
        ? prisma.videoBookmark.findFirst({ where: { userId: authUserId, videoId: id } })
        : Promise.resolve(null),
    ]);

    // Check if creator has an active livestream
    const activeLivestream = await prisma.livestream.findFirst({
      where: { userId: video.userId, status: 'live' },
      select: { sessionId: true },
    });

    const signed = await signVideoUrls(video);

    res.json({
      success: true,
      data: {
        id: video.id,
        title: video.title || 'Untitled Video',
        description: video.description || '',
        videoUrl: signed.videoUrl,
        thumbnail: signed.thumbnail,
        userId: video.userId,
        likes: video.likes || 0,
        views: video.views || 0,
        isLiked: !!userLike,
        isBookmarked: !!userBookmark,
        commentsCount: video.commentsCount || 0,
        createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(),
        duration: video.duration || 0,
        comments: [],
        isLive: !!activeLivestream,
        livestreamSessionId: activeLivestream?.sessionId || null,
        user: video.user ? {
          id: video.user.id,
          firstName: video.user.firstName || 'Anonymous',
          lastName: video.user.lastName || '',
          avatar: video.user.avatar,
        } : null,
      },
    });
  } catch (error) {
    console.error('VideoController: getVideoById - Error occurred:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch video' });
  }
});

// ============================================================================
// TRENDING — Enhanced engagement-velocity scoring with time-decay
// Score includes share rate and completion rate for 2026 quality signals
// Supports pagination and locale filtering (country/language)
// ============================================================================

const MIN_TRENDING_VIEWS = 10; // Quality gate: minimum views to be trending-eligible
const MAX_VIDEOS_PER_CREATOR_TRENDING = 3; // Abuse prevention: cap per creator

export const getTrendingVideos = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const country = req.query.country || null;
    const language = req.query.language || null;
    const authUserId = req.user?.id;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build where clause with optional locale filters + quality gate
    const where = {
      createdAt: { gte: sevenDaysAgo },
      views: { gte: MIN_TRENDING_VIEWS },
      ...(country && { country }),
      ...(language && { language }),
    };

    // Fetch blocked users and feedback for safety filtering
    const [videos, total, userLikes, userBookmarks, blockedUsers, userFeedback] = await Promise.all([
      prisma.video.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true, followersCount: true } },
        },
        take: Math.min(limit * 5, 250), // Extra headroom for per-creator cap
        orderBy: { createdAt: 'desc' },
      }),
      prisma.video.count({ where }),
      authUserId
        ? prisma.videoLike.findMany({ where: { userId: authUserId }, select: { videoId: true } })
        : Promise.resolve([]),
      authUserId
        ? prisma.videoBookmark.findMany({ where: { userId: authUserId }, select: { videoId: true } })
        : Promise.resolve([]),
      authUserId
        ? prisma.userBlock.findMany({ where: { blockerId: authUserId }, select: { blockedId: true } })
        : Promise.resolve([]),
      authUserId
        ? prisma.videoFeedback.findMany({
            where: { userId: authUserId, action: { in: ['not_interested', 'hide_creator'] } },
            select: { videoId: true, action: true },
          })
        : Promise.resolve([]),
    ]);

    const likedSet = new Set(userLikes.map(l => l.videoId));
    const bookmarkedSet = new Set(userBookmarks.map(b => b.videoId));
    const blockedSet = new Set(blockedUsers.map(b => b.blockedId));
    const hiddenVideoIds = new Set(userFeedback.filter(f => f.action === 'not_interested').map(f => f.videoId));
    const hiddenCreatorVideoIds = new Set();
    const hiddenCreatorIdsFromFeedback = new Set();
    for (const fb of userFeedback) {
      if (fb.action === 'hide_creator') hiddenCreatorIdsFromFeedback.add(fb.videoId);
    }

    const now = Date.now();

    // Score and filter
    const scored = await Promise.all(videos
      .filter(video => {
        // Safety: exclude blocked creators
        if (blockedSet.has(video.userId)) return false;
        // Safety: exclude hidden videos
        if (hiddenVideoIds.has(video.id)) return false;
        return true;
      })
      .map(async (video) => {
        const hoursAge = (now - video.createdAt.getTime()) / (1000 * 60 * 60);
        const shareRate = video.views > 0 ? (video.sharesCount || 0) / video.views : 0;
        const completionRate = video.views > 0 ? (video.completionsCount || 0) / video.views : 0;
        const followerCount = video.user?.followersCount || 1;

        const engagementScore =
          (video.likes * 2) +
          video.views +
          (video.commentsCount * 3) +
          (shareRate * 50) +
          (completionRate * 40);

        // Velocity normalization: divide by sqrt(followers) to prevent spam
        const normalizedEngagement = engagementScore / Math.sqrt(followerCount + 1);
        const trendingScore = normalizedEngagement / Math.pow(hoursAge + 2, 1.5);

        // Determine trending reason
        let trendingReason = 'popular_this_week';
        if (shareRate > 0.1) trendingReason = 'viral_shares';
        else if (completionRate > 0.5) trendingReason = 'high_completion';
        else if (hoursAge < 12 && engagementScore > 50) trendingReason = 'rapid_engagement';
        else if (followerCount < 50 && trendingScore > 5) trendingReason = 'rising_creator';

        const signed = await signVideoUrls(video);
        return {
          id: video.id,
          title: video.title || 'Untitled Video',
          description: video.description || '',
          videoUrl: signed.videoUrl,
          thumbnail: signed.thumbnail,
          userId: video.userId,
          likes: video.likes || 0,
          views: video.views || 0,
          isLiked: likedSet.has(video.id),
          isBookmarked: bookmarkedSet.has(video.id),
          commentsCount: video.commentsCount || 0,
          createdAt: video.createdAt.toISOString(),
          updatedAt: video.updatedAt.toISOString(),
          duration: video.duration || 0,
          topicTags: video.topicTags || [],
          comments: [],
          user: video.user ? {
            id: video.user.id,
            firstName: video.user.firstName || 'Anonymous',
            lastName: video.user.lastName || '',
            avatar: video.user.avatar,
          } : null,
          trendingScore,
          trendingReason,
        };
      }));

    scored.sort((a, b) => b.trendingScore - a.trendingScore);

    // Per-creator cap: max MAX_VIDEOS_PER_CREATOR_TRENDING videos per creator
    const creatorCounts = new Map();
    const capped = scored.filter(video => {
      const count = creatorCounts.get(video.userId) || 0;
      if (count >= MAX_VIDEOS_PER_CREATOR_TRENDING) return false;
      creatorCounts.set(video.userId, count + 1);
      return true;
    });

    const paged = capped.slice(skip, skip + limit);
    const totalPages = Math.ceil(Math.min(capped.length, total) / limit);

    res.json({
      success: true,
      message: 'Trending videos fetched successfully',
      data: paged,
      pagination: { page, limit, total: capped.length, totalPages, hasMore: page < totalPages },
    });
  } catch (error) {
    console.error('VideoController: getTrendingVideos - Error:', error);
    res.status(500).json({ message: 'Failed to fetch trending videos' });
  }
});

// ============================================================================
// FOLLOWING — Real follow graph with engagement-proxy fallback
// Uses CreatorFollow model first; falls back to likes/bookmarks for users
// who haven't explicitly followed anyone yet (migration bridge).
// ============================================================================

export const getFollowingVideos = asyncHandler(async (req, res) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.json({ success: true, data: [], message: 'Login to see videos from creators you follow' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Step 1: Get explicitly followed creator IDs
    const explicitFollows = await prisma.creatorFollow.findMany({
      where: { followerId: authUserId },
      select: { followingId: true },
    });
    let followedCreatorIds = explicitFollows.map(f => f.followingId);

    // Step 2: Fallback to engagement-proxy if user has 0 explicit follows
    let usingFallback = false;
    if (followedCreatorIds.length === 0) {
      usingFallback = true;
      const [likedCreators, bookmarkedCreators] = await Promise.all([
        prisma.videoLike.findMany({
          where: { userId: authUserId },
          select: { video: { select: { userId: true } } },
        }),
        prisma.videoBookmark.findMany({
          where: { userId: authUserId },
          select: { video: { select: { userId: true } } },
        }),
      ]);
      followedCreatorIds = [
        ...new Set([
          ...likedCreators.map(l => l.video.userId),
          ...bookmarkedCreators.map(b => b.video.userId),
        ]),
      ];
    }

    // Exclude own videos and blocked users
    const blockedUsers = await prisma.userBlock.findMany({
      where: { blockerId: authUserId },
      select: { blockedId: true },
    });
    const blockedSet = new Set(blockedUsers.map(b => b.blockedId));
    followedCreatorIds = followedCreatorIds.filter(id => id !== authUserId && !blockedSet.has(id));

    if (followedCreatorIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
        message: usingFallback
          ? 'Like or bookmark videos to see more from those creators'
          : 'Follow creators to see their videos here',
      });
    }

    // Step 3: Fetch recent videos from followed creators
    const [videos, total, userLikes, userBookmarks] = await Promise.all([
      prisma.video.findMany({
        where: { userId: { in: followedCreatorIds } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.video.count({ where: { userId: { in: followedCreatorIds } } }),
      prisma.videoLike.findMany({ where: { userId: authUserId }, select: { videoId: true } }),
      prisma.videoBookmark.findMany({ where: { userId: authUserId }, select: { videoId: true } }),
    ]);

    const likedSet = new Set(userLikes.map(l => l.videoId));
    const bookmarkedSet = new Set(userBookmarks.map(b => b.videoId));

    const formattedVideos = await Promise.all(videos.map(async (video) => {
      const signed = await signVideoUrls(video);
      return {
        id: video.id,
        title: video.title || 'Untitled Video',
        description: video.description || '',
        videoUrl: signed.videoUrl,
        thumbnail: signed.thumbnail,
        userId: video.userId,
        likes: video.likes || 0,
        views: video.views || 0,
        isLiked: likedSet.has(video.id),
        isBookmarked: bookmarkedSet.has(video.id),
        isFollowing: true,
        commentsCount: video.commentsCount || 0,
        createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(),
        duration: video.duration || 0,
        topicTags: video.topicTags || [],
        comments: [],
        user: video.user ? {
          id: video.user.id,
          firstName: video.user.firstName || 'Anonymous',
          lastName: video.user.lastName || '',
          avatar: video.user.avatar,
        } : null,
      };
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: 'Following videos fetched successfully',
      data: formattedVideos,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    });
  } catch (error) {
    console.error('VideoController: getFollowingVideos - Error:', error);
    res.status(500).json({ message: 'Failed to fetch following videos' });
  }
});

// Update Video Information
export const updateVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl } = req.body;

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: { title, description, videoUrl },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    const signed = await signVideoUrls(updatedVideo);
    res.json({
      message: 'Video updated successfully',
      video: {
        ...updatedVideo,
        videoUrl: signed.videoUrl,
        thumbnail: signed.thumbnail,
        user: {
          id: updatedVideo.user.id,
          firstName: updatedVideo.user.firstName,
          lastName: updatedVideo.user.lastName,
          avatar: updatedVideo.user.avatar
        }
      }
    });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ message: 'Failed to update video' });
  }
});

// Delete a Video
export const deleteVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // First delete all comments associated with the video
    await prisma.comment.deleteMany({
      where: { videoId: id },
    });

    // Then delete the video
    await prisma.video.delete({
      where: { id },
    });

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: 'Failed to delete video' });
  }
});

// Like a Video — per-user with idempotency
export const likeVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if already liked
    const existingLike = await prisma.videoLike.findUnique({
      where: { userId_videoId: { userId, videoId: id } },
    });

    if (existingLike) {
      return res.status(409).json({
        message: 'Video already liked',
        video: { ...video, isLiked: true },
      });
    }

    // Create like + increment counter atomically
    const [, updatedVideo] = await prisma.$transaction([
      prisma.videoLike.create({ data: { userId, videoId: id } }),
      prisma.video.update({
        where: { id },
        data: { likes: { increment: 1 } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
    ]);

    // SSE: Notify video owner of like
    if (video.userId !== userId) {
      publishEvent(video.userId, 'video.like', {
        videoId: id,
        likes: updatedVideo.likes,
      }).catch(() => {});
    }

    const signed = await signVideoUrls(updatedVideo);
    res.json({
      message: 'Video liked successfully',
      video: { ...updatedVideo, videoUrl: signed.videoUrl, thumbnail: signed.thumbnail, isLiked: true },
    });
  } catch (error) {
    console.error('Error liking video:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Bookmark a Video — per-user toggle
export const bookmarkVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if already bookmarked
    const existingBookmark = await prisma.videoBookmark.findUnique({
      where: { userId_videoId: { userId, videoId: id } },
    });

    if (existingBookmark) {
      // Remove bookmark
      await prisma.videoBookmark.delete({
        where: { userId_videoId: { userId, videoId: id } },
      });
      return res.json({
        message: 'Bookmark removed',
        isBookmarked: false,
        videoId: id,
      });
    }

    // Add bookmark
    await prisma.videoBookmark.create({ data: { userId, videoId: id } });
    res.json({
      message: 'Video bookmarked',
      isBookmarked: true,
      videoId: id,
    });
  } catch (error) {
    console.error('Error bookmarking video:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Get per-user like/bookmark status for a video
export const getVideoStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [like, bookmark] = await Promise.all([
      prisma.videoLike.findUnique({
        where: { userId_videoId: { userId, videoId: id } },
      }),
      prisma.videoBookmark.findUnique({
        where: { userId_videoId: { userId, videoId: id } },
      }),
    ]);

    res.json({
      success: true,
      data: { videoId: id, isLiked: !!like, isBookmarked: !!bookmark },
    });
  } catch (error) {
    console.error('Error fetching video status:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Increment Video Views
export const incrementVideoViews = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Atomically increment views count
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        views: {
          increment: 1,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    const signed = await signVideoUrls(updatedVideo);
    res.json({
      message: 'Video view incremented successfully',
      video: {
        ...updatedVideo,
        videoUrl: signed.videoUrl,
        thumbnail: signed.thumbnail,
        user: {
          id: updatedVideo.user.id,
          firstName: updatedVideo.user.firstName,
          lastName: updatedVideo.user.lastName,
          avatar: updatedVideo.user.avatar
        }
      }
    });
  } catch (error) {
    console.error('Error incrementing video views:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Share a Video (Track share action for analytics)
export const shareVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { platform } = req.body;
    // Use authenticated user from optionalAuth (JWT), never from request body
    const userId = req.user?.id || null;

    // Validate platform
    const validPlatforms = ['copy', 'twitter', 'facebook', 'whatsapp', 'instagram', 'telegram', 'email', 'sms', 'other'];
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({
        message: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
      });
    }

    // Check if video exists (lightweight select)
    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Create individual share record + increment denormalized counter atomically
    await prisma.$transaction([
      prisma.videoShare.create({
        data: { videoId: id, userId, platform },
      }),
      prisma.video.update({
        where: { id },
        data: { sharesCount: { increment: 1 } },
      }),
    ]);

    res.json({
      success: true,
      message: `Video shared successfully via ${platform}`,
      data: {
        shared: true,
        platform,
        videoId: id,
        videoTitle: video.title,
        sharedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error sharing video:', error);
    res.status(500).json({ message: 'Failed to track share action' });
  }
});

// Get Video Comments
export const getVideoComments = asyncHandler(async (req, res) => {
  try {
    const { id: videoId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Verify video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Get comments with pagination
    const skip = (Number(page) - 1) * Number(limit);
    const comments = await prisma.comment.findMany({
      where: { videoId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    });

    // Get total count for pagination
    const totalComments = await prisma.comment.count({
      where: { videoId }
    });

    res.json({
      success: true,
      message: 'Comments fetched successfully',
      data: {
        comments: comments.map(comment => ({
          id: comment.id,
          text: comment.text,
          mediaUrls: comment.mediaUrls || [],
          userId: comment.userId,
          videoId: comment.videoId,
          createdAt: comment.createdAt.toISOString(),
          user: {
            id: comment.user.id,
            firstName: comment.user.firstName,
            lastName: comment.user.lastName,
            avatar: comment.user.avatar
          }
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalComments,
          totalPages: Math.ceil(totalComments / Number(limit)),
        }
      }
    });
  } catch (error) {
    console.error('Error fetching video comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// Unlike a Video — per-user with idempotency
export const unlikeVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if like exists
    const existingLike = await prisma.videoLike.findUnique({
      where: { userId_videoId: { userId, videoId: id } },
    });

    if (!existingLike) {
      return res.status(409).json({
        message: 'Video not liked',
        video: { ...video, isLiked: false },
      });
    }

    // Delete like + decrement counter atomically
    const [, updatedVideo] = await prisma.$transaction([
      prisma.videoLike.delete({
        where: { userId_videoId: { userId, videoId: id } },
      }),
      prisma.video.update({
        where: { id },
        data: { likes: { decrement: 1 } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
    ]);

    const signed = await signVideoUrls(updatedVideo);
    res.json({
      message: 'Video unliked successfully',
      video: { ...updatedVideo, videoUrl: signed.videoUrl, thumbnail: signed.thumbnail, isLiked: false },
    });
  } catch (error) {
    console.error('Error unliking video:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// ============================================================================
// VIDEO PREMIUM & LIMITS ENDPOINTS
// ============================================================================

// Video limits constants
const VIDEO_LIMITS = {
  FREE: {
    maxUploadSizeBytes: 40 * 1024 * 1024, // 40MB
    maxRecordingDurationSeconds: 300, // 5 minutes
    maxLivestreamDurationSeconds: 300, // 5 minutes
  },
  PREMIUM: {
    maxUploadSizeBytes: 500 * 1024 * 1024, // 500MB
    maxRecordingDurationSeconds: 1800, // 30 minutes
    maxLivestreamDurationSeconds: 7200, // 2 hours
  },
};

// Get user's video premium status and limits
export const getVideoLimits = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Get user with subscription status
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        surveysubscriptionStatus: true,
        currentSubscriptionId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has video premium (could be based on subscription or specific entitlement)
    // For now, we check if they have an active subscription
    const hasVideoPremium = user.subscriptionStatus === 'ACTIVE';

    const limits = hasVideoPremium ? VIDEO_LIMITS.PREMIUM : VIDEO_LIMITS.FREE;

    res.json({
      success: true,
      data: {
        hasVideoPremium,
        maxUploadSize: limits.maxUploadSizeBytes,
        maxRecordingDuration: limits.maxRecordingDurationSeconds,
        maxLivestreamDuration: limits.maxLivestreamDurationSeconds,
        // Include human-readable versions
        maxUploadSizeFormatted: hasVideoPremium ? '500 MB' : '40 MB',
        maxRecordingDurationFormatted: hasVideoPremium ? '30 minutes' : '5 minutes',
        maxLivestreamDurationFormatted: hasVideoPremium ? '2 hours' : '5 minutes',
      },
    });
  } catch (error) {
    console.error('Error getting video limits:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Validate upload request before uploading
export const validateUpload = asyncHandler(async (req, res) => {
  try {
    const { userId, fileSize, fileName, mimeType } = req.body;

    // Validate required fields
    if (!userId || fileSize === undefined) {
      return res.status(400).json({ 
        message: 'userId and fileSize are required',
        valid: false,
      });
    }

    // Validate mime type
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'];
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        message: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
        valid: false,
        error: 'INVALID_FILE_TYPE',
      });
    }

    // Get user's subscription status
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        valid: false,
      });
    }

    const hasVideoPremium = user.subscriptionStatus === 'ACTIVE';
    const limits = hasVideoPremium ? VIDEO_LIMITS.PREMIUM : VIDEO_LIMITS.FREE;

    // Check file size
    if (fileSize > limits.maxUploadSizeBytes) {
      const maxSizeFormatted = hasVideoPremium ? '500 MB' : '40 MB';
      const fileSizeFormatted = (fileSize / (1024 * 1024)).toFixed(1) + ' MB';
      
      return res.status(413).json({
        message: `File size (${fileSizeFormatted}) exceeds maximum allowed (${maxSizeFormatted})`,
        valid: false,
        error: 'FILE_TOO_LARGE',
        upgradeRequired: !hasVideoPremium,
        currentLimit: limits.maxUploadSizeBytes,
        premiumLimit: VIDEO_LIMITS.PREMIUM.maxUploadSizeBytes,
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Upload validation passed',
      data: {
        hasVideoPremium,
        fileSize,
        fileName,
        maxUploadSize: limits.maxUploadSizeBytes,
      },
    });
  } catch (error) {
    console.error('Error validating upload:', error);
    res.status(500).json({ message: 'Something went wrong', valid: false });
  }
});

// Start a livestream or recording session
export const startLivestream = asyncHandler(async (req, res) => {
  try {
    // Use authenticated user from verifyToken middleware
    const userId = req.user.id;
    const { title, description, type: sessionType = 'livestream' } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Get user's subscription status
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hasVideoPremium = user.subscriptionStatus === 'ACTIVE';
    const limits = hasVideoPremium ? VIDEO_LIMITS.PREMIUM : VIDEO_LIMITS.FREE;

    // Use appropriate duration limit based on session type
    const maxDuration = sessionType === 'recording'
      ? limits.maxRecordingDurationSeconds
      : limits.maxLivestreamDurationSeconds;

    // Generate stream key
    const streamKey = `stream_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Persist session to database
    const livestream = await prisma.livestream.create({
      data: {
        sessionId: streamKey,
        userId,
        title: title || (sessionType === 'recording' ? 'Recording' : 'Live Stream'),
        description: description || '',
        status: sessionType === 'recording' ? 'pending' : 'live',
        type: sessionType === 'recording' ? 'recording' : 'livestream',
        streamKey,
        startedAt: new Date(),
        maxDurationSeconds: maxDuration,
        isPremium: hasVideoPremium,
      },
    });

    // Only notify via SSE for actual livestreams (not plain recordings)
    if (sessionType !== 'recording') {
      await publishEvent(userId, 'livestream.started', {
        sessionId: livestream.sessionId,
        userId,
        title: livestream.title,
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: livestream.sessionId,
        streamKey,
        maxDuration,
        maxDurationFormatted: sessionType === 'recording'
          ? (hasVideoPremium ? '30 minutes' : '5 minutes')
          : (hasVideoPremium ? '2 hours' : '5 minutes'),
        hasVideoPremium,
        type: livestream.type,
        streamer: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
        },
        title: livestream.title,
        description: livestream.description || '',
        startedAt: livestream.startedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error starting livestream:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// End a livestream or recording session
export const endLivestream = asyncHandler(async (req, res) => {
  try {
    const { sessionId, duration, viewerCount, peakViewers } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // Update session record in database
    const livestream = await prisma.livestream.update({
      where: { sessionId },
      data: {
        status: 'ended',
        endedAt: new Date(),
        durationSeconds: duration ? Math.round(duration) : null,
        viewerCount: viewerCount || 0,
        peakViewerCount: peakViewers || 0,
      },
    });

    // Only notify via SSE for actual livestreams (not plain recordings)
    if (livestream.type === 'livestream') {
      await publishEvent(livestream.userId, 'livestream.ended', {
        sessionId,
        durationSeconds: livestream.durationSeconds,
      });
    }

    res.json({
      success: true,
      message: 'Session ended successfully',
      data: {
        sessionId,
        duration: livestream.durationSeconds,
        viewerCount: livestream.viewerCount,
        peakViewers: livestream.peakViewerCount,
        endedAt: livestream.endedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Get active livestreams
export const getLiveStreams = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [livestreams, total] = await Promise.all([
      prisma.livestream.findMany({
        where: { status: 'live', type: 'livestream' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { viewerCount: 'desc' },
        skip,
        take: limit,
      }),
      prisma.livestream.count({ where: { status: 'live', type: 'livestream' } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: livestreams.map(ls => ({
        id: ls.id,
        sessionId: ls.sessionId,
        title: ls.title,
        description: ls.description,
        status: ls.status,
        viewerCount: ls.viewerCount,
        peakViewerCount: ls.peakViewerCount,
        startedAt: ls.startedAt?.toISOString(),
        isPremium: ls.isPremium,
        user: ls.user ? {
          id: ls.user.id,
          firstName: ls.user.firstName || 'Anonymous',
          lastName: ls.user.lastName || '',
          avatar: ls.user.avatar,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching live streams:', error);
    res.status(500).json({ message: 'Failed to fetch live streams' });
  }
});

// Viewer tracking: join a livestream
export const joinLivestream = asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const livestream = await prisma.livestream.findUnique({
      where: { sessionId },
    });

    if (!livestream || livestream.status !== 'live') {
      return res.status(404).json({ message: 'Livestream not found or not active' });
    }

    const updated = await prisma.livestream.update({
      where: { sessionId },
      data: {
        viewerCount: { increment: 1 },
        peakViewerCount: Math.max(livestream.peakViewerCount, livestream.viewerCount + 1),
      },
    });

    // Notify stream owner of viewer count change
    await publishEvent(livestream.userId, 'livestream.viewerCount', {
      sessionId,
      viewerCount: updated.viewerCount,
      peakViewerCount: updated.peakViewerCount,
    });

    res.json({ success: true, viewerCount: updated.viewerCount });
  } catch (error) {
    console.error('Error joining livestream:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Viewer tracking: leave a livestream
export const leaveLivestream = asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;

    const livestream = await prisma.livestream.findUnique({
      where: { sessionId },
    });

    if (!livestream) {
      return res.status(404).json({ message: 'Livestream not found' });
    }

    const updated = await prisma.livestream.update({
      where: { sessionId },
      data: {
        viewerCount: Math.max(0, livestream.viewerCount - 1),
      },
    });

    await publishEvent(livestream.userId, 'livestream.viewerCount', {
      sessionId,
      viewerCount: updated.viewerCount,
      peakViewerCount: updated.peakViewerCount,
    });

    res.json({ success: true, viewerCount: updated.viewerCount });
  } catch (error) {
    console.error('Error leaving livestream:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Send a chat message to a livestream
export const sendLivestreamChat = asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const livestream = await prisma.livestream.findUnique({
      where: { sessionId },
    });

    if (!livestream || livestream.status !== 'live') {
      return res.status(404).json({ message: 'Livestream not found or not active' });
    }

    // Get sender info
    const sender = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    const chatPayload = {
      sessionId,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      userName: sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Anonymous',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    // Notify stream owner of chat message
    await publishEvent(livestream.userId, 'livestream.chat', chatPayload);

    res.json({ success: true, data: chatPayload });
  } catch (error) {
    console.error('Error sending livestream chat:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// ============================================================================
// TELEMETRY — Batch event ingestion for feed personalization
// POST /api/videos/events — Accepts up to 100 events per batch
// Always returns 200 (telemetry should never fail the client)
// ============================================================================

export const ingestVideoEvents = asyncHandler(async (req, res) => {
  try {
    const { events, sessionId } = req.body;
    const userId = req.user?.id || null;

    if (!Array.isArray(events) || events.length === 0) {
      return res.json({ success: true, ingested: 0 });
    }

    const capped = events.slice(0, 100);

    const validEventTypes = [
      'impression', 'play_3s', 'play_25pct', 'play_50pct', 'play_75pct',
      'play_100pct', 'skip', 'rewatch', 'dwell', 'like', 'bookmark', 'share', 'comment',
    ];

    const records = capped
      .filter(e => e.videoId && validEventTypes.includes(e.eventType))
      .map(e => ({
        userId,
        videoId: e.videoId,
        eventType: e.eventType,
        payload: e.payload || {},
        sessionId: sessionId || e.sessionId || 'unknown',
        createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
      }));

    if (records.length > 0) {
      await prisma.videoEvent.createMany({ data: records, skipDuplicates: true });
    }

    res.json({ success: true, ingested: records.length });
  } catch (error) {
    console.error('VideoController: ingestVideoEvents - Error:', error);
    res.json({ success: false, ingested: 0 });
  }
});

// ============================================================================
// PERSONALIZED FEED — ML-lite scoring based on telemetry signals
// GET /api/videos/personalized — Falls back to recency for cold start / anon
// ============================================================================

const MAX_VIDEOS_PER_CREATOR_PERSONALIZED = 2; // Diversity: max per creator in a single page

export const getPersonalizedVideos = asyncHandler(async (req, res) => {
  try {
    const authUserId = req.user?.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Parse excluded IDs (seen videos this session)
    let excludeIds = [];
    if (req.query.exclude) {
      try {
        excludeIds = JSON.parse(req.query.exclude);
        if (!Array.isArray(excludeIds)) excludeIds = [];
        excludeIds = excludeIds.slice(0, 200);
      } catch { excludeIds = []; }
    }

    const baseWhere = excludeIds.length > 0 ? { id: { notIn: excludeIds } } : undefined;

    // Cold start / anonymous: fall back to recency-sorted feed with recommendation reasons
    if (!authUserId) {
      const [videos, total, activeLivestreams] = await Promise.all([
        prisma.video.findMany({
          where: baseWhere,
          include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.video.count(baseWhere ? { where: baseWhere } : undefined),
        prisma.livestream.findMany({ where: { status: 'live' }, select: { userId: true, sessionId: true } }),
      ]);

      const liveUserMap = new Map(activeLivestreams.map(ls => [ls.userId, ls.sessionId]));

      const formattedVideos = await Promise.all(videos.map(async (video) => {
        const signed = await signVideoUrls(video);
        // Determine reason for anonymous users
        let recommendationReason = 'popular_this_week';
        if ((video.views || 0) < 100) recommendationReason = 'new_creator_spotlight';
        return {
          id: video.id, title: video.title || 'Untitled Video', description: video.description || '',
          videoUrl: signed.videoUrl, thumbnail: signed.thumbnail, userId: video.userId,
          likes: video.likes || 0, views: video.views || 0, isLiked: false, isBookmarked: false,
          commentsCount: video.commentsCount || 0, createdAt: video.createdAt.toISOString(),
          updatedAt: video.updatedAt.toISOString(), duration: video.duration || 0, comments: [],
          topicTags: video.topicTags || [],
          isLive: liveUserMap.has(video.userId), livestreamSessionId: liveUserMap.get(video.userId) || null,
          user: video.user ? { id: video.user.id, firstName: video.user.firstName || 'Anonymous', lastName: video.user.lastName || '', avatar: video.user.avatar } : null,
          recommendationReason,
        };
      }));
      const totalPages = Math.ceil(total / limit);
      return res.json({ success: true, data: formattedVideos, pagination: { page, limit, total, totalPages, hasMore: page < totalPages } });
    }

    // ── AUTHENTICATED USER FLOW ──

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Parallel data fetch: telemetry, follows, blocks, feedback
    const [recentEvents, explicitFollows, blockedUsers, userFeedback] = await Promise.all([
      prisma.videoEvent.groupBy({
        by: ['videoId', 'eventType'],
        where: { userId: authUserId, createdAt: { gte: fourteenDaysAgo } },
        _count: true,
      }),
      prisma.creatorFollow.findMany({
        where: { followerId: authUserId },
        select: { followingId: true },
      }),
      prisma.userBlock.findMany({
        where: { blockerId: authUserId },
        select: { blockedId: true },
      }),
      prisma.videoFeedback.findMany({
        where: { userId: authUserId, action: { in: ['not_interested', 'hide_creator'] } },
        select: { videoId: true, action: true },
      }),
    ]);

    // Safety sets
    const blockedSet = new Set(blockedUsers.map(b => b.blockedId));
    const hiddenVideoIds = new Set(userFeedback.filter(f => f.action === 'not_interested').map(f => f.videoId));
    const followedCreatorIds = new Set(explicitFollows.map(f => f.followingId));

    // Cold-start tier based on event count
    const totalEventCount = recentEvents.length;
    const isColdStart = totalEventCount < 10;
    const isWarmStart = totalEventCount >= 10 && totalEventCount < 50;

    // Build per-video signal map
    const videoSignals = new Map();
    for (const event of recentEvents) {
      const sig = videoSignals.get(event.videoId) || { watchPct: 0, liked: false, skipped: false };
      if (event.eventType === 'play_100pct') sig.watchPct = 100;
      else if (event.eventType === 'play_75pct') sig.watchPct = Math.max(sig.watchPct, 75);
      else if (event.eventType === 'play_50pct') sig.watchPct = Math.max(sig.watchPct, 50);
      else if (event.eventType === 'play_25pct') sig.watchPct = Math.max(sig.watchPct, 25);
      else if (event.eventType === 'like') sig.liked = true;
      else if (event.eventType === 'skip') sig.skipped = true;
      videoSignals.set(event.videoId, sig);
    }

    // Identify preferred creators (creators of videos the user watched 50%+)
    const watchedVideoIds = [...videoSignals.entries()]
      .filter(([, s]) => s.watchPct >= 50)
      .map(([id]) => id);
    const watchedVideos = watchedVideoIds.length > 0
      ? await prisma.video.findMany({ where: { id: { in: watchedVideoIds } }, select: { userId: true } })
      : [];
    const preferredCreators = new Set(watchedVideos.map(v => v.userId));
    // Merge followed creators into preferred
    for (const id of followedCreatorIds) preferredCreators.add(id);

    // All interacted creators (for cold-start exploration exclusion)
    const interactedCreators = new Set([...preferredCreators, ...followedCreatorIds]);

    // Fetch candidates (5x limit for scoring headroom + diversity enforcement)
    const [candidates, total, activeLivestreams, userLikes, userBookmarks] = await Promise.all([
      prisma.video.findMany({
        where: {
          ...baseWhere,
          userId: { notIn: [...blockedSet] },
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit * 5,
      }),
      prisma.video.count(baseWhere ? { where: baseWhere } : undefined),
      prisma.livestream.findMany({ where: { status: 'live' }, select: { userId: true, sessionId: true } }),
      prisma.videoLike.findMany({ where: { userId: authUserId }, select: { videoId: true } }),
      prisma.videoBookmark.findMany({ where: { userId: authUserId }, select: { videoId: true } }),
    ]);

    const liveUserMap = new Map(activeLivestreams.map(ls => [ls.userId, ls.sessionId]));
    const likedSet = new Set(userLikes.map(l => l.videoId));
    const bookmarkedSet = new Set(userBookmarks.map(b => b.videoId));
    const now = Date.now();

    // Filter out hidden content
    const filteredCandidates = candidates.filter(video => {
      if (hiddenVideoIds.has(video.id)) return false;
      if (blockedSet.has(video.userId)) return false;
      return true;
    });

    // Score each candidate with recommendation reasons
    const scored = filteredCandidates.map(video => {
      const hoursAge = (now - video.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyBoost = Math.max(0, 10 - hoursAge / 24);
      const isFollowed = followedCreatorIds.has(video.userId);
      const creatorBoost = preferredCreators.has(video.userId) ? 5 : 0;
      const followBoost = isFollowed ? 8 : 0;
      const engagementScore = (video.likes * 2) + video.views + (video.commentsCount * 3);
      const normalizedEngagement = Math.log10(engagementScore + 1) * 3;
      const userSig = videoSignals.get(video.id);
      const skipPenalty = userSig?.skipped ? -8 : 0;
      const likeBoost = userSig?.liked ? 3 : 0;
      const avgWatchWeight = preferredCreators.has(video.userId) ? 4 : 0;
      const newCreatorBoost = (video.views || 0) < 100 ? 3 : 0;
      const explorationBoost = !interactedCreators.has(video.userId) ? 2 : 0;

      const score = avgWatchWeight + normalizedEngagement + likeBoost + skipPenalty
        + recencyBoost + creatorBoost + followBoost + newCreatorBoost + explorationBoost;

      // Determine recommendation reason
      let recommendationReason = 'popular_this_week';
      if (isFollowed) recommendationReason = 'from_followed_creator';
      else if (creatorBoost > 0) recommendationReason = 'because_you_liked_similar';
      else if (newCreatorBoost > 0) recommendationReason = 'new_creator_spotlight';
      else if (engagementScore > 100 && hoursAge < 48) recommendationReason = 'trending_in_your_area';

      return { video, score, recommendationReason };
    });

    scored.sort((a, b) => b.score - a.score);

    // Cold-start bandit: reserve slots for exploration
    let finalVideos;
    if (isColdStart) {
      // 50% explore (unseen creators) + 50% top scored
      const exploreVideos = scored.filter(s => !interactedCreators.has(s.video.userId));
      const topVideos = scored.filter(s => interactedCreators.has(s.video.userId) || preferredCreators.has(s.video.userId));
      const halfLimit = Math.floor(limit / 2);
      finalVideos = [
        ...exploreVideos.slice(0, halfLimit).map(s => ({ ...s, recommendationReason: 'new_creator_spotlight' })),
        ...topVideos.slice(0, limit - halfLimit),
      ];
    } else if (isWarmStart) {
      // 30% explore + 70% personalized
      const exploreCount = Math.floor(limit * 0.3);
      const exploreVideos = scored.filter(s => !interactedCreators.has(s.video.userId));
      const topVideos = scored.filter(s => interactedCreators.has(s.video.userId) || engagementScore > 0);
      finalVideos = [
        ...topVideos.slice(0, limit - exploreCount),
        ...exploreVideos.slice(0, exploreCount).map(s => ({ ...s, recommendationReason: 'new_creator_spotlight' })),
      ];
    } else {
      finalVideos = scored;
    }

    // Diversity enforcement: max N videos per creator in a single page
    const creatorCounts = new Map();
    const diverseVideos = finalVideos.filter(({ video }) => {
      const count = creatorCounts.get(video.userId) || 0;
      if (count >= MAX_VIDEOS_PER_CREATOR_PERSONALIZED) return false;
      creatorCounts.set(video.userId, count + 1);
      return true;
    });

    const paged = diverseVideos.slice(skip, skip + limit);

    const formattedVideos = await Promise.all(paged.map(async ({ video, recommendationReason }) => {
      const signed = await signVideoUrls(video);
      return {
        id: video.id, title: video.title || 'Untitled Video', description: video.description || '',
        videoUrl: signed.videoUrl, thumbnail: signed.thumbnail, userId: video.userId,
        likes: video.likes || 0, views: video.views || 0,
        isLiked: likedSet.has(video.id), isBookmarked: bookmarkedSet.has(video.id),
        isFollowing: followedCreatorIds.has(video.userId),
        commentsCount: video.commentsCount || 0, createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(), duration: video.duration || 0, comments: [],
        topicTags: video.topicTags || [],
        isLive: liveUserMap.has(video.userId), livestreamSessionId: liveUserMap.get(video.userId) || null,
        user: video.user ? { id: video.user.id, firstName: video.user.firstName || 'Anonymous', lastName: video.user.lastName || '', avatar: video.user.avatar } : null,
        recommendationReason,
      };
    }));

    const totalPages = Math.ceil(total / limit);
    res.json({
      success: true,
      data: formattedVideos,
      pagination: { page, limit, total, totalPages, hasMore: diverseVideos.length > skip + limit },
    });
  } catch (error) {
    console.error('VideoController: getPersonalizedVideos - Error:', error);
    res.status(500).json({ message: 'Failed to fetch personalized videos' });
  }
});

// ============================================================================
// SEARCH — Dedicated server-side search with relevance scoring
// GET /api/videos/search?q=&page=&limit=
// ============================================================================

export const searchVideos = asyncHandler(async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const authUserId = req.user?.id;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } });
    }

    const searchWhere = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    };

    const [videos, total, userLikes, userBookmarks] = await Promise.all([
      prisma.video.findMany({
        where: searchWhere,
        include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit * 2, // Over-fetch for relevance re-ranking
      }),
      prisma.video.count({ where: searchWhere }),
      authUserId
        ? prisma.videoLike.findMany({ where: { userId: authUserId }, select: { videoId: true } })
        : Promise.resolve([]),
      authUserId
        ? prisma.videoBookmark.findMany({ where: { userId: authUserId }, select: { videoId: true } })
        : Promise.resolve([]),
    ]);

    const likedSet = new Set(userLikes.map(l => l.videoId));
    const bookmarkedSet = new Set(userBookmarks.map(b => b.videoId));
    const qLower = q.toLowerCase();

    // Client-side relevance scoring (avoids raw SQL portability issues)
    const scored = await Promise.all(videos.map(async (video) => {
      const title = (video.title || '').toLowerCase();
      const desc = (video.description || '').toLowerCase();
      let relevance = 0;
      if (title === qLower) relevance = 100;
      else if (title.startsWith(qLower)) relevance = 90;
      else if (title.includes(qLower)) relevance = 70;
      else if (desc.startsWith(qLower)) relevance = 50;
      else if (desc.includes(qLower)) relevance = 30;

      const signed = await signVideoUrls(video);
      return {
        id: video.id, title: video.title || 'Untitled Video', description: video.description || '',
        videoUrl: signed.videoUrl, thumbnail: signed.thumbnail, userId: video.userId,
        likes: video.likes || 0, views: video.views || 0,
        isLiked: likedSet.has(video.id), isBookmarked: bookmarkedSet.has(video.id),
        commentsCount: video.commentsCount || 0,
        createdAt: video.createdAt.toISOString(), updatedAt: video.updatedAt.toISOString(),
        duration: video.duration || 0, comments: [],
        user: video.user ? { id: video.user.id, firstName: video.user.firstName || 'Anonymous', lastName: video.user.lastName || '', avatar: video.user.avatar } : null,
        relevance,
      };
    }));

    scored.sort((a, b) => b.relevance - a.relevance || 0);
    const paged = scored.slice(0, limit);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: `Search results for "${q}"`,
      data: paged,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    });
  } catch (error) {
    console.error('VideoController: searchVideos - Error:', error);
    res.status(500).json({ message: 'Failed to search videos' });
  }
});

// ============================================================================
// USER FEEDBACK — Not Interested / Hide Creator / Report
// POST /api/videos/feedback — Requires auth
// ============================================================================

export const submitVideoFeedback = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { videoId, action, reason } = req.body;

    const validActions = ['not_interested', 'hide_creator', 'hide_sound', 'report'];
    if (!videoId || !action || !validActions.includes(action)) {
      return res.status(400).json({ message: `Invalid. action must be one of: ${validActions.join(', ')}` });
    }

    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const feedback = await prisma.videoFeedback.upsert({
      where: { userId_videoId_action: { userId, videoId, action } },
      create: { userId, videoId, action, reason },
      update: { reason, createdAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Feedback recorded',
      data: { feedbackId: feedback.id, action, videoId, creatorId: video.userId },
    });
  } catch (error) {
    console.error('VideoController: submitVideoFeedback - Error:', error);
    res.status(500).json({ message: 'Failed to record feedback' });
  }
});

// ============================================================================
// COMPLETION TRACKING — Increment denormalized completionsCount
// POST /api/videos/:id/completion — Public endpoint
// ============================================================================

export const recordVideoCompletion = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) return res.status(404).json({ message: 'Video not found' });

    await prisma.video.update({
      where: { id },
      data: { completionsCount: { increment: 1 } },
    });

    res.json({ success: true, message: 'Completion recorded' });
  } catch (error) {
    console.error('VideoController: recordVideoCompletion - Error:', error);
    res.status(500).json({ message: 'Failed to record completion' });
  }
});

// ============================================================================
// EXPLORE — Random videos for feed diversity
// GET /api/videos/explore?limit= — Public endpoint
// ============================================================================

export const getExploreVideos = asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const authUserId = req.user?.id;

    const total = await prisma.video.count();
    const maxSkip = Math.max(0, total - limit);
    const randomSkip = Math.floor(Math.random() * maxSkip);

    const [videos, userLikes, userBookmarks] = await Promise.all([
      prisma.video.findMany({
        include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        skip: randomSkip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      authUserId
        ? prisma.videoLike.findMany({ where: { userId: authUserId }, select: { videoId: true } })
        : Promise.resolve([]),
      authUserId
        ? prisma.videoBookmark.findMany({ where: { userId: authUserId }, select: { videoId: true } })
        : Promise.resolve([]),
    ]);

    const likedSet = new Set(userLikes.map(l => l.videoId));
    const bookmarkedSet = new Set(userBookmarks.map(b => b.videoId));

    const formattedVideos = await Promise.all(videos.map(async (video) => {
      const signed = await signVideoUrls(video);
      return {
        id: video.id, title: video.title || 'Untitled Video', description: video.description || '',
        videoUrl: signed.videoUrl, thumbnail: signed.thumbnail, userId: video.userId,
        likes: video.likes || 0, views: video.views || 0,
        isLiked: likedSet.has(video.id), isBookmarked: bookmarkedSet.has(video.id),
        commentsCount: video.commentsCount || 0, createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(), duration: video.duration || 0, comments: [],
        user: video.user ? { id: video.user.id, firstName: video.user.firstName || 'Anonymous', lastName: video.user.lastName || '', avatar: video.user.avatar } : null,
      };
    }));

    res.json({ success: true, data: formattedVideos });
  } catch (error) {
    console.error('VideoController: getExploreVideos - Error:', error);
    res.status(500).json({ message: 'Failed to fetch explore videos' });
  }
});

// Check if user can start recording/livestream (duration validation)
export const validateSessionDuration = asyncHandler(async (req, res) => {
  try {
    const { userId, sessionType, currentDuration } = req.body;

    if (!userId || !sessionType) {
      return res.status(400).json({ 
        message: 'userId and sessionType are required',
        valid: false,
      });
    }

    if (!['recording', 'livestream'].includes(sessionType)) {
      return res.status(400).json({
        message: 'sessionType must be "recording" or "livestream"',
        valid: false,
      });
    }

    // Get user's subscription status
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        valid: false,
      });
    }

    const hasVideoPremium = user.subscriptionStatus === 'ACTIVE';
    const limits = hasVideoPremium ? VIDEO_LIMITS.PREMIUM : VIDEO_LIMITS.FREE;
    
    const maxDuration = sessionType === 'livestream' 
      ? limits.maxLivestreamDurationSeconds 
      : limits.maxRecordingDurationSeconds;

    const duration = currentDuration || 0;
    const remainingSeconds = maxDuration - duration;
    const isNearLimit = remainingSeconds <= 30;
    const limitReached = remainingSeconds <= 0;

    res.json({
      success: true,
      valid: !limitReached,
      data: {
        hasVideoPremium,
        sessionType,
        currentDuration: duration,
        maxDuration,
        remainingSeconds: Math.max(0, remainingSeconds),
        isNearLimit,
        limitReached,
        upgradeRequired: limitReached && !hasVideoPremium,
        premiumMaxDuration: sessionType === 'livestream' 
          ? VIDEO_LIMITS.PREMIUM.maxLivestreamDurationSeconds 
          : VIDEO_LIMITS.PREMIUM.maxRecordingDurationSeconds,
      },
    });
  } catch (error) {
    console.error('Error validating session duration:', error);
    res.status(500).json({ message: 'Something went wrong', valid: false });
  }
});
