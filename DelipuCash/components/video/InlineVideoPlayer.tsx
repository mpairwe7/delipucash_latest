/**
 * InlineVideoPlayer Component
 * YouTube-like inline video preview player
 * Plays videos inline within feed without full-screen
 * Industry Standard UX - Tap to play/pause, muted autoplay preview
 * 
 * Features:
 * - Tap to play/pause inline
 * - Muted preview playback (YouTube Shorts style)
 * - Progress indicator
 * - Smooth transitions between thumbnail and video
 * - Long press to expand to full player
 * - Double tap to like
 * 
 * @example
 * ```tsx
 * <InlineVideoPlayer
 *   video={videoData}
 *   onExpand={() => openFullPlayer(video)}
 *   onLike={() => handleLike(video.id)}
 * />
 * ```
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Play,
  Pause,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  Maximize2,
  Clock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  COMPONENT_SIZE,
  withAlpha,
} from '@/utils/theme';
import { Video } from '@/types';
import { getBestThumbnailUrl, getPlaceholderImage } from '@/utils/thumbnail-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const DOUBLE_TAP_DELAY = 300;
const LONG_PRESS_DELAY = 500;
const CONTROLS_HIDE_DELAY = 3000;

// ============================================================================
// TYPES
// ============================================================================

export interface InlineVideoPlayerProps {
  /** Video data */
  video: Video;
  /** Whether this card is currently visible in viewport */
  isVisible?: boolean;
  /** Callback when user wants to expand to full player */
  onExpand?: () => void;
  /** Callback when video is liked */
  onLike?: () => void;
  /** Callback when video is commented */
  onComment?: () => void;
  /** Callback when video is shared */
  onShare?: () => void;
  /** Whether video is liked by current user */
  isLiked?: boolean;
  /** Show engagement actions (like, comment, share) */
  showActions?: boolean;
  /** Auto-play when visible (muted) */
  autoPlay?: boolean;
  /** Test ID */
  testID?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatViews = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

const formatDuration = (seconds: number = 0): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// COMPONENT
// ============================================================================

function InlineVideoPlayerComponent({
  video,
  isVisible = true,
  onExpand,
  onLike,
  onComment,
  onShare,
  isLiked = false,
  showActions = true,
  autoPlay = false,
  testID,
}: InlineVideoPlayerProps): React.ReactElement {
  const { colors } = useTheme();
  
  // ============================================================================
  // STATE
  // ============================================================================
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [showControls, setShowControls] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(video.thumbnail || null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [duration, setDuration] = useState(video.duration || 0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Refs
  const lastTapRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Animation values
  const scale = useSharedValue(1);
  const playButtonOpacity = useSharedValue(1);
  const likeScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);
  
  // ============================================================================
  // VIDEO PLAYER
  // ============================================================================
  
  const player = useVideoPlayer(video.videoUrl || null, (player) => {
    try {
      player.loop = true;
      player.muted = isMuted;
      player.volume = isMuted ? 0 : 1;
    } catch (error) {
      console.warn('[InlineVideoPlayer] Error configuring player:', error);
    }
  });
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Load thumbnail
  useEffect(() => {
    const loadThumbnail = async () => {
      if (video.thumbnail) {
        setThumbnailUrl(video.thumbnail);
        return;
      }
      
      if (video.videoUrl) {
        setIsLoadingThumbnail(true);
        try {
          const generated = await getBestThumbnailUrl({
            thumbnailUrl: video.thumbnail,
            videoUrl: video.videoUrl,
          });
          setThumbnailUrl(generated || getPlaceholderImage('video'));
        } catch {
          setThumbnailUrl(getPlaceholderImage('video'));
        } finally {
          setIsLoadingThumbnail(false);
        }
      }
    };
    
    loadThumbnail();
  }, [video.thumbnail, video.videoUrl]);
  
  // Handle visibility changes (pause when scrolled off screen)
  useEffect(() => {
    if (!isVisible && isPlaying) {
      player.pause();
      setIsPlaying(false);
      setShowThumbnail(true);
    }
  }, [isVisible, isPlaying, player]);
  
  // Auto-play when visible (muted)
  useEffect(() => {
    if (autoPlay && isVisible && !isPlaying && player) {
      setShowThumbnail(false);
      player.play();
      setIsPlaying(true);
      playButtonOpacity.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, isVisible]);
  
  // Player status subscription
  useEffect(() => {
    if (!player) return;
    
    const statusSubscription = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setIsBuffering(false);
        if (player.duration) {
          setDuration(player.duration);
        }
      } else if (event.status === 'loading') {
        setIsBuffering(true);
      }
    });
    
    const playingSubscription = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
      if (event.isPlaying) {
        setShowThumbnail(false);
      }
    });
    
    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
    };
  }, [player]);
  
  // Progress tracking
  useEffect(() => {
    if (!player || !isPlaying) return;
    
    const interval = setInterval(() => {
      if (player.currentTime && duration > 0) {
        const prog = player.currentTime / duration;
        progressWidth.value = withTiming(prog * 100, { duration: 100 });
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [player, isPlaying, duration, progressWidth]);
  
  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, CONTROLS_HIDE_DELAY);
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handlePlay = useCallback(() => {
    if (!player) return;
    
    setShowThumbnail(false);
    player.play();
    setIsPlaying(true);
    playButtonOpacity.value = withTiming(0, { duration: 200 });
  }, [player, playButtonOpacity]);
  
  const handlePause = useCallback(() => {
    if (!player) return;
    
    player.pause();
    setIsPlaying(false);
    playButtonOpacity.value = withTiming(1, { duration: 200 });
    setShowControls(true);
  }, [player, playButtonOpacity]);
  
  const handleTogglePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
    
    setShowControls(true);
  }, [isPlaying, handlePlay, handlePause]);
  
  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (player) {
      player.muted = newMuted;
      player.volume = newMuted ? 0 : 1;
    }
  }, [isMuted, player]);
  
  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // Double tap - like
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      likeScale.value = withSpring(1.5, { damping: 10 }, () => {
        likeScale.value = withSpring(1);
      });
      onLike?.();
    } else {
      // Single tap - toggle play/pause
      handleTogglePlayPause();
    }
    
    lastTapRef.current = now;
  }, [handleTogglePlayPause, onLike, likeScale]);
  
  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onExpand?.();
  }, [onExpand]);
  
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15 });
  }, [scale]);
  
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
  }, [scale]);
  
  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================
  
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const animatedPlayButtonStyle = useAnimatedStyle(() => ({
    opacity: playButtonOpacity.value,
    transform: [{ scale: interpolate(playButtonOpacity.value, [0, 1], [0.8, 1], Extrapolation.CLAMP) }],
  }));
  
  const animatedLikeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));
  
  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  const isLive = video.videoUrl?.includes('.m3u8') || video.videoUrl?.includes('live');
  
  return (
    <Animated.View
      testID={testID}
      style={[
        styles.container,
        animatedContainerStyle,
        { backgroundColor: colors.card },
      ]}
      entering={FadeIn.duration(300)}
    >
      <Pressable
        onPress={handleTap}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={LONG_PRESS_DELAY}
        style={styles.pressable}
      >
        {/* Video / Thumbnail Container */}
        <View style={styles.videoContainer}>
          {/* Thumbnail Layer */}
          {(showThumbnail || isLoadingThumbnail) && (
            <Animated.View 
              style={styles.thumbnailLayer}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
            >
              {isLoadingThumbnail ? (
                <View style={[styles.thumbnail, styles.loadingContainer, { backgroundColor: colors.border }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <ImageBackground
                  source={{ uri: thumbnailUrl || getPlaceholderImage('video') }}
                  style={styles.thumbnail}
                  imageStyle={styles.thumbnailImage}
                  resizeMode="cover"
                />
              )}
            </Animated.View>
          )}
          
          {/* Video Layer */}
          {!showThumbnail && video.videoUrl && (
            <View style={styles.videoLayer}>
              <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
                onError={(error) => {
                  console.warn('[InlineVideoPlayer] VideoView error:', error);
                  // Ignore keep-awake related errors in Expo Go
                  if (error?.message?.includes('keep awake')) {
                    return;
                  }
                }}
              />
            </View>
          )}
          
          {/* Overlay Gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.5, 1]}
            style={styles.gradient}
            pointerEvents="none"
          />
          
          {/* Controls Overlay */}
          {showControls && (
            <Animated.View 
              style={styles.controlsOverlay}
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
            >
              {/* Center Play/Pause Button */}
              <Animated.View style={[styles.centerPlayButton, animatedPlayButtonStyle]}>
                <View style={[styles.playButtonBg, { backgroundColor: withAlpha('#000000', 0.5) }]}>
                  {isBuffering ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : isPlaying ? (
                    <Pause size={32} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
                  )}
                </View>
              </Animated.View>
              
              {/* Top Right Controls */}
              <View style={styles.topRightControls}>
                {/* Mute Button */}
                <Pressable
                  onPress={handleToggleMute}
                  style={[styles.iconButton, { backgroundColor: withAlpha('#000000', 0.5) }]}
                  hitSlop={8}
                >
                  {isMuted ? (
                    <VolumeX size={18} color="#FFFFFF" />
                  ) : (
                    <Volume2 size={18} color="#FFFFFF" />
                  )}
                </Pressable>
                
                {/* Expand Button */}
                <Pressable
                  onPress={onExpand}
                  style={[styles.iconButton, { backgroundColor: withAlpha('#000000', 0.5) }]}
                  hitSlop={8}
                >
                  <Maximize2 size={18} color="#FFFFFF" />
                </Pressable>
              </View>
              
              {/* Live Badge */}
              {isLive && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveIndicator} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
              
              {/* Duration Badge (when not playing) */}
              {!isLive && !isPlaying && duration > 0 && (
                <View style={[styles.durationBadge, { backgroundColor: withAlpha('#000000', 0.7) }]}>
                  <Clock size={10} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.durationText}>{formatDuration(duration)}</Text>
                </View>
              )}
            </Animated.View>
          )}
          
          {/* Progress Bar */}
          {isPlaying && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, { backgroundColor: withAlpha('#FFFFFF', 0.3) }]}>
                <Animated.View 
                  style={[styles.progressFill, { backgroundColor: colors.primary }, animatedProgressStyle]} 
                />
              </View>
            </View>
          )}
        </View>
        
        {/* Video Info */}
        <View style={styles.infoContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {video.title || 'Untitled Video'}
          </Text>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Eye size={14} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatViews(video.views || 0)}
              </Text>
            </View>
            
            <View style={styles.metaItem}>
              <Heart size={14} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatViews(video.likes || 0)}
              </Text>
            </View>
            
            {video.commentsCount > 0 && (
              <View style={styles.metaItem}>
                <MessageCircle size={14} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {formatViews(video.commentsCount)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
      
      {/* Side Actions (YouTube Shorts style) */}
      {showActions && (
        <View style={styles.sideActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onLike?.();
            }}
            style={styles.actionButton}
          >
            <Animated.View style={animatedLikeStyle}>
              <Heart 
                size={24} 
                color={isLiked ? colors.error : colors.text} 
                fill={isLiked ? colors.error : 'transparent'}
                strokeWidth={1.5}
              />
            </Animated.View>
            <Text style={[styles.actionText, { color: colors.text }]}>
              {formatViews(video.likes || 0)}
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onComment?.();
            }}
            style={styles.actionButton}
          >
            <MessageCircle size={24} color={colors.text} strokeWidth={1.5} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              {formatViews(video.commentsCount || 0)}
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onShare?.();
            }}
            style={styles.actionButton}
          >
            <Share2 size={24} color={colors.text} strokeWidth={1.5} />
            <Text style={[styles.actionText, { color: colors.text }]}>Share</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  pressable: {
    flex: 1,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#000000',
  },
  thumbnailLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailImage: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayButton: {
    position: 'absolute',
  },
  playButtonBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRightControls: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  durationBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 3,
  },
  durationText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 4,
  },
  progressTrack: {
    flex: 1,
  },
  progressFill: {
    height: '100%',
  },
  infoContainer: {
    padding: SPACING.md,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
    marginBottom: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  sideActions: {
    position: 'absolute',
    right: SPACING.sm,
    bottom: 80,
    alignItems: 'center',
    gap: SPACING.md,
  },
  actionButton: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const InlineVideoPlayer = memo(InlineVideoPlayerComponent);
export default InlineVideoPlayer;
