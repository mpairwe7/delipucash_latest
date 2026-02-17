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
        isBookmarked: false,
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
    const { platform, userId } = req.body;

    // Validate platform
    const validPlatforms = ['copy', 'twitter', 'facebook', 'whatsapp', 'instagram', 'telegram', 'email', 'sms'];
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({ 
        message: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` 
      });
    }

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id },
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

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Log share event for analytics (in a real app, this would be stored in an analytics table)
    console.log(`Video ${id} shared via ${platform} by user ${userId || 'anonymous'}`);

    // Optionally track in a VideoShare table if needed for analytics
    // await prisma.videoShare.create({
    //   data: { videoId: id, userId, platform, sharedAt: new Date() }
    // });

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
