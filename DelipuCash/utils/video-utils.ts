/**
 * Video Utilities
 * Comprehensive video handling utilities
 * Design System Compliant - Consistent formatting and helpers
 */

import { Dimensions, Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface VideoQuality {
  label: string;
  resolution: string;
  bitrate: number;
  fps: number;
}

export interface VideoMetadata {
  duration: number; // in seconds
  width: number;
  height: number;
  fps?: number;
  bitrate?: number;
  codec?: string;
  size?: number; // in bytes
}

export interface ResponsiveSize {
  small: number;
  medium: number;
  large: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Screen size breakpoints
export const SCREEN_BREAKPOINTS = {
  small: 375,
  medium: 768,
  large: 1024,
} as const;

// Device detection
export const isSmallScreen = SCREEN_WIDTH < SCREEN_BREAKPOINTS.small;
export const isMediumScreen = SCREEN_WIDTH >= SCREEN_BREAKPOINTS.small && SCREEN_WIDTH < SCREEN_BREAKPOINTS.medium;
export const isTablet = SCREEN_WIDTH >= SCREEN_BREAKPOINTS.medium;
export const isLargeScreen = SCREEN_WIDTH >= SCREEN_BREAKPOINTS.large;
export const isLandscape = SCREEN_WIDTH > SCREEN_HEIGHT;

// Video quality presets
export const VIDEO_QUALITIES: Record<string, VideoQuality> = {
  '240p': { label: '240p', resolution: '426x240', bitrate: 400000, fps: 24 },
  '360p': { label: '360p', resolution: '640x360', bitrate: 750000, fps: 30 },
  '480p': { label: '480p', resolution: '854x480', bitrate: 1500000, fps: 30 },
  '720p': { label: '720p HD', resolution: '1280x720', bitrate: 3000000, fps: 30 },
  '1080p': { label: '1080p FHD', resolution: '1920x1080', bitrate: 6000000, fps: 60 },
  '4k': { label: '4K UHD', resolution: '3840x2160', bitrate: 15000000, fps: 60 },
};

// Max recording duration in seconds (free users: 5 minutes, premium: 30 minutes)
export const MAX_RECORDING_DURATION = 300; // 5 minutes for free users
export const MAX_RECORDING_DURATION_PREMIUM = 1800; // 30 minutes for premium users

// Max livestream duration in seconds (free users: 5 minutes, premium: unlimited)
export const MAX_LIVESTREAM_DURATION = 300; // 5 minutes for free users
export const MAX_LIVESTREAM_DURATION_PREMIUM = 7200; // 2 hours for premium users

// Max upload file size in bytes (free users: 40MB, premium: 500MB)
export const MAX_UPLOAD_SIZE_FREE = 40 * 1024 * 1024; // 40MB
export const MAX_UPLOAD_SIZE_PREMIUM = 500 * 1024 * 1024; // 500MB

// Helper to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// ============================================================================
// RESPONSIVE HELPERS
// ============================================================================

/**
 * Get responsive value based on screen size
 */
export const getResponsiveSize = (
  small: number,
  medium: number,
  large: number
): number => {
  if (isLargeScreen) return large;
  if (isTablet) return medium;
  if (isMediumScreen) return medium;
  return small;
};

/**
 * Get responsive padding based on screen size
 */
export const getResponsivePadding = (): number => {
  if (isLargeScreen) return 32;
  if (isTablet) return 24;
  if (isSmallScreen) return 16;
  return 20;
};

/**
 * Get responsive font size
 */
export const getResponsiveFontSize = (baseSize: number): number => {
  const scale = SCREEN_WIDTH / 375; // Base scale on iPhone X width
  const scaledSize = baseSize * Math.min(scale, 1.3);
  return Math.round(scaledSize);
};

/**
 * Get optimal video dimensions for screen
 */
export const getOptimalVideoDimensions = (
  aspectRatio: number = 16 / 9
): { width: number; height: number } => {
  if (isLandscape) {
    const height = SCREEN_HEIGHT * 0.9;
    const width = height * aspectRatio;
    return { width: Math.min(width, SCREEN_WIDTH), height };
  }
  
  const width = SCREEN_WIDTH;
  const height = width / aspectRatio;
  return { width, height };
};

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format duration for display with labels
 */
export const formatDurationWithLabels = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0 sec';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Format recording time with REC indicator
 */
export const formatRecordingTime = (seconds: number, maxDuration: number): string => {
  const current = formatDuration(seconds);
  const max = formatDuration(maxDuration);
  return `${current} / ${max}`;
};

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export const getRelativeTime = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
};

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format large numbers with K, M, B suffixes
 */
export const formatCount = (count: number): string => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (count < 1000000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${(count / 1000000000).toFixed(1).replace(/\.0$/, '')}B`;
};

/**
 * Format view count with label
 */
export const formatViews = (views: number): string => {
  const formatted = formatCount(views);
  return `${formatted} ${views === 1 ? 'view' : 'views'}`;
};

/**
 * Format like count
 */
export const formatLikes = (likes: number): string => {
  const formatted = formatCount(likes);
  return `${formatted} ${likes === 1 ? 'like' : 'likes'}`;
};

// ============================================================================
// VIDEO VALIDATION
// ============================================================================

/**
 * Validate video duration
 */
export const isValidDuration = (
  durationSecs: number,
  maxDuration: number = MAX_RECORDING_DURATION
): boolean => {
  return durationSecs > 0 && durationSecs <= maxDuration;
};

/**
 * Validate video file size (in bytes)
 */
export const isValidFileSize = (
  sizeBytes: number,
  maxSizeMB: number = 100
): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeBytes > 0 && sizeBytes <= maxSizeBytes;
};

/**
 * Validate video aspect ratio
 */
export const isValidAspectRatio = (
  width: number,
  height: number,
  allowedRatios: number[] = [16/9, 9/16, 4/3, 1]
): boolean => {
  if (height === 0) return false;
  const ratio = width / height;
  const tolerance = 0.1;
  return allowedRatios.some(r => Math.abs(ratio - r) < tolerance);
};

// ============================================================================
// CAMERA UTILITIES
// ============================================================================

/**
 * Calculate zoom level from pinch gesture
 */
export const calculateZoomFromPinch = (
  currentZoom: number,
  scale: number,
  minZoom: number = 0,
  maxZoom: number = 1
): number => {
  const delta = (scale - 1) * 0.5;
  const newZoom = currentZoom + delta;
  return Math.max(minZoom, Math.min(maxZoom, newZoom));
};

/**
 * Get safe area insets for different platforms
 */
export const getSafeAreaPadding = (): { top: number; bottom: number } => {
  if (Platform.OS === 'ios') {
    return { top: 44, bottom: 34 };
  }
  return { top: 24, bottom: 20 };
};

// ============================================================================
// VIDEO URL UTILITIES
// ============================================================================

/**
 * Check if URL is a valid video URL
 */
export const isValidVideoUrl = (url: string): boolean => {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol.toLowerCase();
    return ['http:', 'https:', 'rtmp:', 'rtsp:'].includes(protocol);
  } catch {
    return false;
  }
};

/**
 * Get video ID from various platform URLs
 */
export const extractVideoId = (url: string): { platform: string; id: string } | null => {
  const patterns: Record<string, RegExp> = {
    youtube: /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/,
    vimeo: /vimeo\.com\/(\d+)/,
    tiktok: /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    instagram: /instagram\.com\/(?:reel|p)\/([^/?]+)/,
  };
  
  for (const [platform, pattern] of Object.entries(patterns)) {
    const match = url.match(pattern);
    if (match) {
      return { platform, id: match[1] };
    }
  }
  
  return null;
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  // Responsive
  getResponsiveSize,
  getResponsivePadding,
  getResponsiveFontSize,
  getOptimalVideoDimensions,
  isSmallScreen,
  isMediumScreen,
  isTablet,
  isLargeScreen,
  isLandscape,
  
  // Time formatting
  formatDuration,
  formatDurationWithLabels,
  formatRecordingTime,
  getRelativeTime,
  
  // Number formatting
  formatCount,
  formatViews,
  formatLikes,
  
  // Validation
  isValidDuration,
  isValidFileSize,
  isValidAspectRatio,
  isValidVideoUrl,
  
  // Camera
  calculateZoomFromPinch,
  getSafeAreaPadding,
  
  // URL utilities
  extractVideoId,
  
  // Constants
  SCREEN_BREAKPOINTS,
  VIDEO_QUALITIES,
  MAX_RECORDING_DURATION,
  MAX_RECORDING_DURATION_PREMIUM,
};
