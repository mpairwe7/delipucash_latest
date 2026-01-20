import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';

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
        timestamp: comment.createdAt.getTime(),
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
      cacheStrategy: cacheStrategies.longLived,
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
      cacheStrategy: cacheStrategies.longLived,
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
        createdAt: video.createdAt.getTime(),
        updatedAt: video.updatedAt.getTime(),
        timestamp: video.createdAt.getTime(),
        duration: 0, // Default duration
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
      message: "All videos fetched successfully", 
      videos: formattedVideos
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