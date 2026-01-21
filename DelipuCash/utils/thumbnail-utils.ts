/**
 * Thumbnail Utilities
 * Video thumbnail generation and management
 * Design System Compliant - Consistent error handling and fallbacks
 */

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

const DEFAULT_THUMBNAIL_TIME = 1000; // 1 second into video
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
 * Generate a thumbnail from a video URL
 * Uses expo-video-thumbnails when available, falls back to placeholder
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
    // Try to use expo-video-thumbnails if available
    // Note: expo-video-thumbnails must be installed separately: npx expo install expo-video-thumbnails
    let VideoThumbnails: any = null;
    try {
      // Dynamic require for optional dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      VideoThumbnails = require('expo-video-thumbnails');
    } catch {
      VideoThumbnails = null;
    }
    
    if (VideoThumbnails?.getThumbnailAsync) {
      const result = await VideoThumbnails.getThumbnailAsync(videoUrl, {
        time,
        quality,
      });
      return result?.uri ?? PLACEHOLDER_IMAGES.video;
    }
    
    // Fallback to placeholder if video-thumbnails not available
    console.log('[Thumbnail] expo-video-thumbnails not available, using placeholder');
    return PLACEHOLDER_IMAGES.video;
  } catch (error) {
    console.error('[Thumbnail] Error generating thumbnail:', error);
    return PLACEHOLDER_IMAGES.video;
  }
};

/**
 * Get the best available thumbnail URL for media content
 * Priority: thumbnailUrl > imageUrl > generated from videoUrl > fallback
 */
export const getBestThumbnailUrl = async (
  media: AdWithMedia,
  generateFromVideo: boolean = false
): Promise<string | null> => {
  // Priority 1: Use existing thumbnailUrl
  if (media.thumbnailUrl && media.thumbnailUrl.trim() !== '') {
    console.log('[Thumbnail] Using existing thumbnailUrl');
    return media.thumbnailUrl;
  }
  
  // Priority 2: Use imageUrl as fallback
  if (media.imageUrl && media.imageUrl.trim() !== '') {
    console.log('[Thumbnail] Using imageUrl as fallback');
    return media.imageUrl;
  }
  
  // Priority 3: Generate from videoUrl (only if explicitly requested)
  if (generateFromVideo && media.videoUrl && media.videoUrl.trim() !== '') {
    try {
      console.log('[Thumbnail] Generating from video URL');
      return await generateThumbnailFromVideo(media.videoUrl);
    } catch (error) {
      console.error('[Thumbnail] Failed to generate from video:', error);
    }
  }
  
  // No suitable source found
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
 * Handles various video hosting services and file extensions
 */
export const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // Check for video file extensions
  if (VIDEO_EXTENSIONS.some(ext => lowerUrl.includes(ext))) {
    return true;
  }
  
  // Check for Firebase Storage URLs (assume video if in videos path)
  if (lowerUrl.includes('firebasestorage.googleapis.com') && lowerUrl.includes('videos')) {
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
