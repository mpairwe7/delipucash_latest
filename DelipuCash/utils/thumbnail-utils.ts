/**
 * Thumbnail Utilities
 * Video thumbnail generation and management
 * Design System Compliant - Consistent error handling and fallbacks
 */

import * as VideoThumbnails from 'expo-video-thumbnails';

// ============================================================================
// TYPES
// ============================================================================

export interface ThumbnailOptions {
  time?: number; // Time in milliseconds to capture thumbnail
  quality?: number; // 0-1 quality setting
  width?: number; // Target width
  height?: number; // Target height
}

export interface ThumbnailResult {
  uri: string;
  width: number;
  height: number;
}

export interface AdWithMedia {
  thumbnailUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_THUMBNAIL_TIME = 0; // Beginning of video
const DEFAULT_THUMBNAIL_QUALITY = 0.8;

// Fallback placeholder images
const PLACEHOLDER_IMAGES = {
  video: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=300&fit=crop',
  live: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=300&fit=crop',
  music: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop',
  default: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop',
};

// Video hosting domains
const VIDEO_HOSTING_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'dailymotion.com',
  'twitch.tv',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
];

// Video file extensions
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.m3u8'];

// ============================================================================
// THUMBNAIL GENERATION
// ============================================================================

/**
 * Generate a thumbnail URL from video URL using expo-video-thumbnails
 * Creates an actual thumbnail from the video when thumbnailUrl is not available
 */
export const generateThumbnailFromVideo = async (
  videoUrl: string,
  options?: ThumbnailOptions
): Promise<string> => {
  const {
    time = DEFAULT_THUMBNAIL_TIME,
    quality = DEFAULT_THUMBNAIL_QUALITY,
  } = options || {};

  try {
    // Generate thumbnail from video URL using expo-video-thumbnails
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
      time,
      quality,
    });

    console.log('[Thumbnail] Successfully generated thumbnail:', uri);
    return uri;
  } catch (error) {
    console.error('[Thumbnail] Error generating thumbnail from video:', error);
    // Return a fallback placeholder if thumbnail generation fails
    return PLACEHOLDER_IMAGES.video;
  }
};

/**
 * Get the best available thumbnail URL for media content
 * Priority: thumbnailUrl > imageUrl > generated from videoUrl (only if thumbnailUrl is empty) > fallback placeholder
 * Handles Firebase Storage URLs and other video URLs without extensions
 */
export const getBestThumbnailUrl = async (
  media: AdWithMedia,
  generateFromVideo: boolean = true
): Promise<string | null> => {
  // First priority: use existing thumbnailUrl
  if (media.thumbnailUrl && media.thumbnailUrl.trim() !== '') {
    console.log('[Thumbnail] Using existing thumbnailUrl:', media.thumbnailUrl);
    return media.thumbnailUrl;
  }

  // Second priority: use imageUrl as fallback
  if (media.imageUrl && media.imageUrl.trim() !== '') {
    console.log('[Thumbnail] Using imageUrl as fallback:', media.imageUrl);
    return media.imageUrl;
  }

  // Third priority: generate from videoUrl ONLY if thumbnailUrl is empty
  if (generateFromVideo && media.videoUrl && media.videoUrl.trim() !== '' && (!media.thumbnailUrl || media.thumbnailUrl.trim() === '')) {
    try {
      console.log('[Thumbnail] Generating thumbnail from video URL (thumbnailUrl is empty):', media.videoUrl);
      return await generateThumbnailFromVideo(media.videoUrl);
    } catch (error) {
      console.error('[Thumbnail] Failed to generate thumbnail from video URL:', media.videoUrl, error);
      // Continue to next priority if thumbnail generation fails
    }
  }

  // Final fallback: return null
  console.log('[Thumbnail] No suitable thumbnail source found');
  return null;
};

/**
 * Get a placeholder image based on content type
 */
export const getPlaceholderImage = (
  type: 'video' | 'live' | 'music' | 'default' = 'default'
): string => {
  return PLACEHOLDER_IMAGES[type] || PLACEHOLDER_IMAGES.default;
};

// ============================================================================
// VIDEO URL DETECTION
// ============================================================================

/**
 * Check if a URL is a video URL
 * Handles Firebase Storage URLs and other video URLs without extensions
 */
export const isVideoUrl = (url: string): boolean => {
  if (!url) return false;

  const lowerUrl = url.toLowerCase();

  // Check for video file extensions
  if (VIDEO_EXTENSIONS.some(ext => lowerUrl.includes(ext))) {
    return true;
  }

  // Check for Firebase Storage URLs (they don't have extensions)
  // Firebase Storage URLs typically contain video content types
  // We can't determine this from URL alone, so we'll assume it's a video
  // if it's being used as videoUrl in the ad
  if (lowerUrl.includes('firebasestorage.googleapis.com')) {
    return true;
  }

  // Check for video hosting services
  if (VIDEO_HOSTING_DOMAINS.some(domain => lowerUrl.includes(domain))) {
    return true;
  }

  // Check for video content types in URL parameters
  if (lowerUrl.includes('video/') || lowerUrl.includes('video%2F')) {
    return true;
  }

  return false;
};

/**
 * Check if a URL is a live stream URL
 */
export const isLiveStreamUrl = (url: string): boolean => {
  if (!url) return false;

  const lowerUrl = url.toLowerCase();

  // Common live stream indicators
  return (
    lowerUrl.includes('.m3u8') ||
    lowerUrl.includes('/live/') ||
    lowerUrl.includes('live-') ||
    lowerUrl.includes('stream') ||
    lowerUrl.includes('rtmp://') ||
    lowerUrl.includes('rtsp://')
  );
};

/**
 * Get video thumbnail from YouTube URL
 */
export const getYouTubeThumbnail = (url: string): string | null => {
  try {
    let videoId: string | null = null;

    // Extract video ID from various YouTube URL formats
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtube\.com\/embed\/([^?]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/v\/([^?]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (videoId) {
      // Return high-quality thumbnail
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    return null;
  } catch (error) {
    console.error('[Thumbnail] Error extracting YouTube thumbnail:', error);
    return null;
  }
};

/**
 * Get video thumbnail from Vimeo URL
 * Note: Requires API call in production
 */
export const getVimeoThumbnail = async (url: string): Promise<string | null> => {
  try {
    const videoIdMatch = url.match(/vimeo\.com\/(\d+)/);
    if (!videoIdMatch) return null;

    const videoId = videoIdMatch[1];

    // In production, you would call the Vimeo oEmbed API
    // For now, return a placeholder
    console.log(`[Thumbnail] Vimeo video ID: ${videoId}`);
    return PLACEHOLDER_IMAGES.video;
  } catch (error) {
    console.error('[Thumbnail] Error extracting Vimeo thumbnail:', error);
    return null;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate thumbnail dimensions
 */
export const validateThumbnailDimensions = (
  width: number,
  height: number,
  minWidth: number = 100,
  minHeight: number = 100,
  maxWidth: number = 4096,
  maxHeight: number = 4096
): boolean => {
  return (
    width >= minWidth &&
    width <= maxWidth &&
    height >= minHeight &&
    height <= maxHeight
  );
};

/**
 * Calculate aspect ratio from dimensions
 */
export const calculateAspectRatio = (width: number, height: number): number => {
  if (height === 0) return 0;
  return width / height;
};

/**
 * Get recommended thumbnail size for display
 */
export const getRecommendedThumbnailSize = (
  containerWidth: number,
  aspectRatio: number = 16 / 9
): { width: number; height: number } => {
  const width = Math.round(containerWidth);
  const height = Math.round(containerWidth / aspectRatio);
  return { width, height };
};

export default {
  generateThumbnailFromVideo,
  getBestThumbnailUrl,
  getPlaceholderImage,
  isVideoUrl,
  isLiveStreamUrl,
  getYouTubeThumbnail,
  getVimeoThumbnail,
  validateThumbnailDimensions,
  calculateAspectRatio,
  getRecommendedThumbnailSize,
};
