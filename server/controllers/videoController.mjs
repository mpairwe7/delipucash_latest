import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';

// Create a Video
export const createVideo = asyncHandler(async (req, res) => {
  try {
    console.log("Received request data:", req.body);

    const { title, description, videoUrl, thumbnail, userId, duration, timestamp } = req.body;

    // Validate required fields
    if (!title || !videoUrl || !userId || !thumbnail) {
      console.warn("Missing fields:", { title, videoUrl, userId, thumbnail });
      return res.status(400).json({ message: "Title, videoUrl, userId, and thumbnail are required" });
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
    const { text, media, user_id, created_at } = req.body;
    console.log("Received request data for comment:", req.body);

    // Validate required fields
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!text && (!media || media.length === 0)) {
      return res.status(400).json({ message: "Comment text or media is required" });
    }

    // Verify user exists
    const user = await prisma.appUser.findUnique({
      where: { id: user_id },
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

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        text: text || "",
        mediaUrls: media || [],
        userId: user_id,
        videoId: videoId,
        createdAt: new Date(created_at),
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

    res.json({ 
      message: 'Videos fetched successfully', 
      videos: videos.map(video => ({
        ...video,
        user: {
          id: video.user.id,
          firstName: video.user.firstName,
          lastName: video.user.lastName,
          avatar: video.user.avatar
        }
      }))
    });
  } catch (error) {
    console.error('Error fetching user videos:', error);
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
});

// Get All Videos (for Streaming or Browsing)
export const getAllVideos = asyncHandler(async (req, res) => {
  try {
    console.log('VideoController: getAllVideos - Starting to fetch videos from database')
    
    const videos = await prisma.video.findMany({
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
      orderBy: {
        createdAt: 'desc'
      },
      // Prisma Accelerate: Long-lived cache for videos (1 hour TTL, 10 min SWR)
    });

    console.log('VideoController: getAllVideos - Database query completed:', {
      videosCount: videos.length,
      videos: videos.slice(0, 2).map(v => ({
        id: v.id,
        title: v.title,
        hasVideoUrl: !!v.videoUrl,
        hasThumbnail: !!v.thumbnail,
        userId: v.userId,
        hasUser: !!v.user,
        videoUrl: v.videoUrl?.substring(0, 50) + '...',
        thumbnail: v.thumbnail?.substring(0, 50) + '...'
      }))
    });

    const formattedVideos = videos.map(video => {
      const formattedVideo = {
        id: video.id,
        title: video.title || 'Untitled Video',
        description: video.description || '',
        videoUrl: video.videoUrl,
        thumbnail: video.thumbnail,
        userId: video.userId,
        likes: video.likes || 0,
        views: video.views || 0,
        isBookmarked: video.isBookmarked || false,
        commentsCount: video.commentsCount || 0,
        createdAt: video.createdAt.toISOString(), // ISO string for frontend consistency
        updatedAt: video.updatedAt.toISOString(), // ISO string for frontend consistency
        duration: video.duration || 0, // Duration in seconds from database
        comments: [], // Empty comments array
        user: video.user ? {
          id: video.user.id,
          firstName: video.user.firstName || 'Anonymous',
          lastName: video.user.lastName || '',
          avatar: video.user.avatar
        } : null
      }
      
      console.log('VideoController: Formatted video:', {
        id: formattedVideo.id,
        title: formattedVideo.title,
        hasVideoUrl: !!formattedVideo.videoUrl,
        hasThumbnail: !!formattedVideo.thumbnail,
        hasUser: !!formattedVideo.user
      })
      
      return formattedVideo
    })

    console.log('VideoController: getAllVideos - Sending response:', {
      videosCount: formattedVideos.length,
      message: "All videos fetched successfully"
    })

    res.json({ 
      success: true,
      message: "All videos fetched successfully", 
      data: formattedVideos,
      pagination: {
        page: 1,
        limit: formattedVideos.length,
        total: formattedVideos.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("VideoController: getAllVideos - Error occurred:", error);
    res.status(500).json({ message: "Failed to fetch videos" });
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

    res.json({ 
      message: 'Video updated successfully', 
      video: {
        ...updatedVideo,
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

// Like a Video (Increment Likes)
export const likeVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Atomically increment likes count
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        likes: {
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

    res.json({ 
      message: 'Video liked successfully', 
      video: {
        ...updatedVideo,
        user: {
          id: updatedVideo.user.id,
          firstName: updatedVideo.user.firstName,
          lastName: updatedVideo.user.lastName,
          avatar: updatedVideo.user.avatar
        }
      }
    });
  } catch (error) {
    console.error('Error liking video:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Bookmark a Video
export const bookmarkVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Toggle bookmark status
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        isBookmarked: !video.isBookmarked,
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

    res.json({ 
      message: 'Video bookmark toggled successfully', 
      video: {
        ...updatedVideo,
        user: {
          id: updatedVideo.user.id,
          firstName: updatedVideo.user.firstName,
          lastName: updatedVideo.user.lastName,
          avatar: updatedVideo.user.avatar
        }
      }
    });
  } catch (error) {
    console.error('Error bookmarking video:', error);
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

    res.json({ 
      message: 'Video view incremented successfully', 
      video: {
        ...updatedVideo,
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

// Unlike a Video (Toggle like - decrement)
export const unlikeVideo = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Atomically decrement likes count (minimum 0)
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        likes: {
          decrement: video.likes > 0 ? 1 : 0,
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

    res.json({ 
      message: 'Video unliked successfully', 
      video: {
        ...updatedVideo,
        isLiked: false,
        user: {
          id: updatedVideo.user.id,
          firstName: updatedVideo.user.firstName,
          lastName: updatedVideo.user.lastName,
          avatar: updatedVideo.user.avatar
        }
      }
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
    maxUploadSizeBytes: 20 * 1024 * 1024, // 20MB
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
        maxUploadSizeFormatted: hasVideoPremium ? '500 MB' : '20 MB',
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
      const maxSizeFormatted = hasVideoPremium ? '500 MB' : '20 MB';
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

// Start a livestream session
export const startLivestream = asyncHandler(async (req, res) => {
  try {
    const { userId, title, description } = req.body;

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

    // Generate stream key (in production, integrate with streaming service)
    const streamKey = `stream_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      success: true,
      data: {
        sessionId: streamKey,
        streamKey,
        maxDuration: limits.maxLivestreamDurationSeconds,
        maxDurationFormatted: hasVideoPremium ? '2 hours' : '5 minutes',
        hasVideoPremium,
        streamer: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
        },
        title: title || 'Live Stream',
        description: description || '',
        startedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error starting livestream:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// End a livestream session
export const endLivestream = asyncHandler(async (req, res) => {
  try {
    const { sessionId, duration, viewerCount, peakViewers } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // In production, save livestream stats to database
    // For now, just acknowledge the end

    res.json({
      success: true,
      message: 'Livestream ended successfully',
      data: {
        sessionId,
        duration,
        viewerCount,
        peakViewers,
        endedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error ending livestream:', error);
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