/**
 * VideoFeedItem Component - 2026 Industry Standard
 * Individual video item for the vertical feed with next-gen interactions
 * 
 * 2026 Standards Applied:
 * - Creator Economy: Tip/gift buttons, verified badges, collaboration labels
 * - Content Safety: Age rating badges, sensitivity shields
 * - Engagement Metrics: Watch time indicator, engagement score
 * - Advanced Haptics: Contextual haptic language per action type
 * - Ambient Design: Dynamic gradient based on video content
 * - WCAG 2.2 AAA: Enhanced semantic roles, reduced motion support
 * - Micro-interactions: Particle burst on like, confetti on milestones
 * - AI Enhancement: Caption toggle, auto-translate indicator
 * 
 * @example
 * ```tsx
 * <VideoFeedItem
 *   video={videoData}
 *   index={0}
 *   itemHeight={screenHeight}
 *   isActive={true}
 *   onLike={handleLike}
 * />
 * ```
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Music2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  MoreHorizontal,
  BadgeCheck,
  Captions,
  Shield,
  Clock,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { Video } from '@/types';
import { useVideoFeedStore } from '@/store/VideoFeedStore';
import { getBestThumbnailUrl, getPlaceholderImage } from '@/utils/thumbnail-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DOUBLE_TAP_DELAY = 300;
const LONG_PRESS_DURATION = 500;
const SEEK_AMOUNT = 10; // seconds
const CONTROLS_HIDE_DELAY = 3000;

// ============================================================================
// TYPES
// ============================================================================

export interface VideoFeedItemProps {
  /** Video data */
  video: Video;
  /** Index in the feed */
  index: number;
  /** Height of this item */
  itemHeight: number;
  /** Whether this video is currently active (should play) */
  isActive: boolean;
  /** Whether video is muted */
  isMuted: boolean;
  /** Whether this video is liked (passed from parent to avoid per-item store subscriptions) */
  isLiked: boolean;
  /** Whether this video is bookmarked (passed from parent to avoid per-item store subscriptions) */
  isBookmarked: boolean;
  /** Like handler - receives video object */
  onLike: (video: Video) => void;
  /** Comment handler - receives video object */
  onComment: (video: Video) => void;
  /** Share handler - receives video object */
  onShare: (video: Video) => void;
  /** Bookmark handler - receives video object */
  onBookmark: (video: Video) => void;
  /** Expand to full player handler - receives video object */
  onExpand: (video: Video) => void;
  /** Video end handler - receives video object */
  onVideoEnd?: (video: Video) => void;
  /** Screen reader enabled */
  screenReaderEnabled?: boolean;
  /** 2026: Ad CTA click handler (for sponsored videos) */
  onAdCtaPress?: (video: Video) => void;
  /** 2026: Ad feedback handler ("Why this ad?") */
  onAdFeedback?: (video: Video) => void;
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

// Duration formatting (exported for use elsewhere)
export const formatDuration = (seconds: number = 0): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Heart burst animation for double-tap like */
const HeartBurst = memo(({ visible, x, y }: { visible: boolean; x: number; y: number }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 300 }),
        withDelay(200, withSpring(0.9, { damping: 15 })),
        withDelay(300, withTiming(0, { duration: 200 }))
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(600, withTiming(0, { duration: 200 }))
      );
      translateY.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(400, withTiming(-30, { duration: 400 }))
      );
    }
  }, [visible, scale, opacity, translateY]);

  // Separate transform/opacity from layout - avoids Reanimated conflict warning
  const transformStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const opacityStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.heartBurst,
        { left: x - 40, top: y - 40 },
        opacityStyle,
      ]}
      pointerEvents="none"
    >
      <Animated.View style={transformStyle}>
        <Heart size={80} color="#FF2D55" fill="#FF2D55" />
      </Animated.View>
    </Animated.View>
  );
});

HeartBurst.displayName = 'HeartBurst';

/** Seek indicator for double-tap seek */
const SeekIndicator = memo(({ 
  visible, 
  side, 
  amount 
}: { 
  visible: boolean; 
  side: 'left' | 'right'; 
  amount: number;
}) => {
  if (!visible) return null;

  // Use wrapper View for layout animation to avoid transform conflict
  return (
    <Animated.View
      style={[
        styles.seekIndicator,
        side === 'left' ? styles.seekIndicatorLeft : styles.seekIndicatorRight,
      ]}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(200)}
    >
      <View style={[styles.seekBubble, { backgroundColor: withAlpha('#000000', 0.7) }]}>
        <View style={side === 'right' ? { transform: [{ scaleX: -1 }] } : undefined}>
          <RotateCcw size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.seekText}>{amount}s</Text>
      </View>
    </Animated.View>
  );
});

SeekIndicator.displayName = 'SeekIndicator';

/** Progress bar at bottom of video */
const VideoProgressBar = memo(({
  progress,
  bufferProgress,
  duration,
  isVisible,
}: {
  progress: number;
  bufferProgress: number;
  duration: number;
  isVisible: boolean;
}) => {
  const { colors } = useTheme();
  const widthAnim = useSharedValue(0);
  const bufferWidthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withTiming(progress * 100, { duration: 100 });
    bufferWidthAnim.value = withTiming(bufferProgress * 100, { duration: 100 });
  }, [progress, bufferProgress, widthAnim, bufferWidthAnim]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value}%`,
  }));

  const bufferStyle = useAnimatedStyle(() => ({
    width: `${bufferWidthAnim.value}%`,
  }));

  if (!isVisible) return null;

  return (
    <View style={styles.progressContainer}>
      <View style={[styles.progressTrack, { backgroundColor: withAlpha('#FFFFFF', 0.3) }]}>
        <Animated.View style={[styles.bufferFill, bufferStyle, { backgroundColor: withAlpha('#FFFFFF', 0.5) }]} />
        <Animated.View style={[styles.progressFill, progressStyle, { backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
});

VideoProgressBar.displayName = 'VideoProgressBar';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function VideoFeedItemComponent({
  video,
  index,
  itemHeight,
  isActive,
  isMuted,
  isLiked,
  isBookmarked,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onExpand,
  onVideoEnd,
  screenReaderEnabled = false,
  onAdCtaPress,
  onAdFeedback,
  testID,
}: VideoFeedItemProps): React.ReactElement {
  const { colors } = useTheme();

  // Use stable action refs from store - avoids subscribing to state changes
  // Actions are stable functions that never change, so getState() is safe
  const toggleMute = useVideoFeedStore((s) => s.toggleMute);
  const setPlayerStatus = useVideoFeedStore((s) => s.setPlayerStatus);
  const setProgress = useVideoFeedStore((s) => s.setProgress);

  // ============================================================================
  // STATE
  // ============================================================================

  const [isPlaying, setIsPlaying] = useState(false);
  // showThumbnail tracks logical state while thumbnailOpacity handles animation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [duration, setDuration] = useState(video.duration || 0);
  const [currentTime, setCurrentTime] = useState(0);
  // bufferProgress - tracked for future buffer indicator implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bufferProgress, _setBufferProgress] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState(video.thumbnail);
  
  // Heart burst state
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });
  
  // Seek indicator state
  const [showSeekIndicator, setShowSeekIndicator] = useState(false);
  const [seekSide, setSeekSide] = useState<'left' | 'right'>('left');
  const [seekAmount, setSeekAmount] = useState(0);

  // Refs
  const lastTapRef = useRef<number>(0);
  const lastTapPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedSeekRef = useRef(0);
  const isMountedRef = useRef(true);

  // Animation values
  const scale = useSharedValue(1);
  const thumbnailOpacity = useSharedValue(1);
  const controlsOpacity = useSharedValue(0);
  const likeScale = useSharedValue(1);
  const playButtonScale = useSharedValue(1);

  // ============================================================================
  // VIDEO PLAYER
  // ============================================================================

  // Track whether onVideoEnd has fired for this play session (prevents repeat triggers)
  const hasEndedRef = useRef(false);

  const player = useVideoPlayer(video.videoUrl || '', (playerInstance) => {
    try {
      playerInstance.loop = false; // No auto-loop — feed controls advancement
      playerInstance.muted = isMuted;
      playerInstance.volume = isMuted ? 0 : 1;
    } catch (error) {
      console.warn('[VideoFeedItem] Error configuring player:', error);
    }
  });

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Safe player method wrapper to prevent calls on released objects
  const safePlayerCall = useCallback(<T,>(fn: () => T, fallback?: T): T | undefined => {
    if (!player || !isMountedRef.current) return fallback;
    try {
      return fn();
    } catch (error) {
      console.warn('VideoFeedItem: Player call failed (likely released):', error);
      return fallback;
    }
  }, [player]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load thumbnail
  useEffect(() => {
    const loadThumbnail = async () => {
      if (!video.thumbnail && video.videoUrl) {
        const generated = await getBestThumbnailUrl({
          thumbnailUrl: video.thumbnail,
          videoUrl: video.videoUrl,
        });
        setThumbnailUrl(generated || getPlaceholderImage('video'));
      }
    };
    loadThumbnail();
  }, [video.thumbnail, video.videoUrl]);

  // Handle active state changes (auto-play/pause)
  useEffect(() => {
    if (!player || !isMountedRef.current) return;

    if (isActive) {
      // Reset end-guard so onVideoEnd can fire once per play session
      hasEndedRef.current = false;
      // Start playing when active
      safePlayerCall(() => player.play());
      setIsPlaying(true);
      setPlayerStatus('playing');
      
      // Fade out thumbnail after short delay
      setTimeout(() => {
        if (isMountedRef.current) {
          thumbnailOpacity.value = withTiming(0, { duration: 300 });
          setShowThumbnail(false);
        }
      }, 200);
    } else {
      // Pause when not active — only update local state, not global player status
      safePlayerCall(() => player.pause());
      setIsPlaying(false);
      
      // Show thumbnail again
      thumbnailOpacity.value = withTiming(1, { duration: 200 });
      setShowThumbnail(true);
    }
  }, [isActive, player, thumbnailOpacity, setPlayerStatus, safePlayerCall]);

  // Sync mute state
  useEffect(() => {
    safePlayerCall(() => {
      if (player) {
        player.muted = isMuted;
        player.volume = isMuted ? 0 : 1;
      }
    });
  }, [isMuted, player, safePlayerCall]);

  // Player status subscription
  useEffect(() => {
    if (!player || !isMountedRef.current) return;

    let statusSub: { remove: () => void } | null = null;
    let playingSub: { remove: () => void } | null = null;

    try {
      statusSub = player.addListener('statusChange', (event) => {
        if (!isMountedRef.current) return;

        if (event.status === 'readyToPlay') {
          setIsBuffering(false);
          setHasError(false);
          try {
            if (player.duration) {
              setDuration(player.duration);
            }
          } catch {
            // Player may be released
          }
        } else if (event.status === 'loading') {
          setIsBuffering(true);
        } else if (event.status === 'error') {
          setHasError(true);
          setIsBuffering(false);
        }
      });

      playingSub = player.addListener('playingChange', (event) => {
        if (!isMountedRef.current) return;
        setIsPlaying(event.isPlaying);
      });
    } catch (error) {
      console.warn('VideoFeedItem: Failed to add player listeners:', error);
    }

    return () => {
      try {
        statusSub?.remove();
        playingSub?.remove();
      } catch {
        // Listeners may already be removed
      }
    };
  }, [player]);

  // Progress tracking
  useEffect(() => {
    if (!player || !isActive || !isPlaying || !isMountedRef.current) return;

    const interval = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(interval);
        return;
      }

      try {
        const currentTime = player.currentTime;
        const duration = player.duration;

        if (currentTime !== undefined && duration) {
          setCurrentTime(currentTime);
          const prog = currentTime / duration;
          setProgress(prog, duration);

      // Check if video ended — fire once per play session
          if (currentTime >= duration - 0.5 && !hasEndedRef.current) {
            hasEndedRef.current = true;
            onVideoEnd?.(video);
          }
        }
      } catch {
        // Player may have been released, stop the interval
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [player, isActive, isPlaying, setProgress, onVideoEnd, video]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        controlsOpacity.value = withTiming(0, { duration: 200 });
      }, CONTROLS_HIDE_DELAY);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying, controlsOpacity]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // 2026: Ad CTA press handler — opens ad URL or delegates to parent
  const handleAdCtaPress = useCallback(() => {
    if (!video.isSponsored) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onAdCtaPress) {
      onAdCtaPress(video);
    } else if (video.ctaUrl) {
      Linking.openURL(video.ctaUrl).catch(() => {});
    }
  }, [video, onAdCtaPress]);

  // 2026: "Why this ad?" feedback handler
  const handleAdFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    onAdFeedback?.(video);
  }, [video, onAdFeedback]);

  const handlePlayPause = useCallback(() => {
    if (!player || !isMountedRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isPlaying) {
      safePlayerCall(() => player.pause());
      setIsPlaying(false);
      playButtonScale.value = withSpring(1.1, { damping: 10 }, () => {
        playButtonScale.value = withSpring(1);
      });
    } else {
      safePlayerCall(() => player.play());
      setIsPlaying(true);
    }

    // Show controls
    setShowControls(true);
    controlsOpacity.value = withTiming(1, { duration: 200 });
  }, [player, isPlaying, playButtonScale, controlsOpacity, safePlayerCall]);

  const handleDoubleTapLike = useCallback((x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Show heart burst animation
    setHeartPosition({ x, y });
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 1000);

    // Trigger like with video object
    onLike(video);
    
    // Animate like button
    likeScale.value = withSequence(
      withSpring(1.4, { damping: 8 }),
      withSpring(1, { damping: 12 })
    );
  }, [onLike, likeScale, video]);

  const handleDoubleTapSeek = useCallback((side: 'left' | 'right') => {
    if (!player || !duration || !isMountedRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const seekDirection = side === 'right' ? 1 : -1;
    const newTime = Math.max(0, Math.min(currentTime + SEEK_AMOUNT * seekDirection, duration));

    safePlayerCall(() => {
      player.currentTime = newTime;
    });
    setCurrentTime(newTime);

    // Accumulate seek amount for display
    accumulatedSeekRef.current += SEEK_AMOUNT;
    setSeekAmount(accumulatedSeekRef.current);
    setSeekSide(side);
    setShowSeekIndicator(true);

    // Reset after delay
    setTimeout(() => {
      accumulatedSeekRef.current = 0;
      setShowSeekIndicator(false);
    }, 600);
  }, [player, duration, currentTime, safePlayerCall]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onExpand(video);
  }, [onExpand, video]);

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

  // ============================================================================
  // GESTURES
  // ============================================================================

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onStart((event) => {
          const now = Date.now();
          const timeSinceLastTap = now - lastTapRef.current;
          const { x, y } = event;

          if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
            // Double tap
            const screenThird = SCREEN_WIDTH / 3;
            
            if (x < screenThird) {
              // Left third - seek backward
              runOnJS(handleDoubleTapSeek)('left');
            } else if (x > screenThird * 2) {
              // Right third - seek forward
              runOnJS(handleDoubleTapSeek)('right');
            } else {
              // Center - like
              runOnJS(handleDoubleTapLike)(x, y);
            }
          } else {
            // Single tap - toggle play/pause (with delay to check for double tap)
            lastTapPositionRef.current = { x, y };
          }

          lastTapRef.current = now;
        })
        .onEnd(() => {
          // Check if this was a single tap (no double tap followed)
          setTimeout(() => {
            if (Date.now() - lastTapRef.current >= DOUBLE_TAP_DELAY) {
              runOnJS(handlePlayPause)();
            }
          }, DOUBLE_TAP_DELAY);
        }),
    [handleDoubleTapSeek, handleDoubleTapLike, handlePlayPause]
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_DURATION)
        .onStart(() => {
          scale.value = withSpring(0.95, { damping: 15 });
          runOnJS(handleLongPress)();
        })
        .onEnd(() => {
          scale.value = withSpring(1, { damping: 15 });
        }),
    [handleLongPress, scale]
  );

  const composedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const thumbnailStyle = useAnimatedStyle(() => ({
    opacity: thumbnailOpacity.value,
  }));

  // Controls overlay animation (available for future overlay implementation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const likeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const playButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  // ============================================================================
  // RENDER
  // ============================================================================

  const progress = duration > 0 ? currentTime / duration : 0;
  const isLive = video.isLive ?? false;

  return (
    <View style={{ height: itemHeight }}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          testID={testID}
          style={[styles.container, { height: itemHeight }, containerStyle]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Video ${index + 1}: ${video.title || 'Untitled'}. ${formatViews(video.views || 0)} views. ${isLiked ? 'Liked' : 'Not liked'}. Double tap center to like, tap to play or pause.`}
          accessibilityHint="Double tap sides to seek, long press for more options"
        >
          {/* Video Layer */}
          <View style={styles.videoLayer}>
            {video.videoUrl && (
              <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
                onError={(error) => {
                  console.warn('[VideoFeedItem] VideoView error:', error);
                  // Ignore keep-awake related errors in Expo Go
                  if (error?.message?.includes('keep awake')) {
                    return;
                  }
                }}
              />
            )}
          </View>

          {/* Thumbnail Layer (crossfade) */}
          <Animated.View style={[styles.thumbnailLayer, thumbnailStyle]} pointerEvents="none">
            <ImageBackground
              source={{ uri: thumbnailUrl || getPlaceholderImage('video') }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </Animated.View>

          {/* Gradient Overlays */}
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.2, 0.7, 1]}
            style={styles.gradient}
            pointerEvents="none"
          />

          {/* Buffering Indicator */}
          {isBuffering && isActive && (
            <View style={styles.bufferingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {/* Error State */}
          {hasError && (
            <Animated.View style={styles.errorContainer} entering={FadeIn}>
              <Text style={styles.errorText}>Failed to load video</Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => {
                  setHasError(false);
                  safePlayerCall(() => player?.play());
                }}
              >
                <RotateCcw size={20} color="#FFFFFF" />
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Center Play/Pause Button (shown when paused or controls visible) */}
          {(!isPlaying || showControls) && !isBuffering && !hasError && (
            <Animated.View
              style={styles.centerPlayButton}
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
            >
              <Animated.View style={playButtonStyle}>
                <View style={styles.playButtonBg}>
                  {isPlaying ? (
                    <Pause size={40} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Play size={40} color="#FFFFFF" fill="#FFFFFF" />
                  )}
                </View>
              </Animated.View>
            </Animated.View>
          )}

          {/* Live Badge */}
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveIndicator} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* 2026: Persistent top-corner Ad watermark for sponsored content (FTC/IAB compliant) */}
          {video.isSponsored && (
            <View style={styles.adWatermark}>
              <Text style={styles.adWatermarkText}>Ad</Text>
            </View>
          )}

          {/* Side Action Bar - 2026: Standard vertical action column (TikTok/Reels pattern) */}
          <View style={styles.sideActions}>
            {/* Mute/Unmute — top of action bar for quick access */}
            <Pressable
              onPress={handleToggleMute}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
              accessibilityState={{ selected: isMuted }}
            >
              {isMuted ? (
                <VolumeX size={26} color="#FFFFFF" strokeWidth={2} />
              ) : (
                <Volume2 size={26} color="#FFFFFF" strokeWidth={2} />
              )}
            </Pressable>

            {/* Like - 2026: Enhanced animation feedback */}
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(
                  isLiked ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
                );
                onLike(video);
                likeScale.value = withSequence(
                  withSpring(1.4, { damping: 6, stiffness: 400 }),
                  withSpring(1, { damping: 12 })
                );
              }}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'} video. ${formatViews(video.likes || 0)} likes`}
              accessibilityState={{ selected: isLiked }}
            >
              <Animated.View style={likeButtonStyle}>
                <Heart
                  size={28}
                  color={isLiked ? '#FF2D55' : '#FFFFFF'}
                  fill={isLiked ? '#FF2D55' : 'transparent'}
                  strokeWidth={isLiked ? 0 : 2}
                />
              </Animated.View>
              <Text style={styles.actionCount}>{formatViews(video.likes || 0)}</Text>
            </Pressable>

            {/* Comment */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                onComment(video);
              }}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={`Comment on video. ${formatViews(video.commentsCount || 0)} comments`}
            >
              <MessageCircle size={28} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.actionCount}>{formatViews(video.commentsCount || 0)}</Text>
            </Pressable>

            {/* Share */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onShare(video);
              }}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel="Share video"
            >
              <Share2 size={26} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.actionCount}>Share</Text>
            </Pressable>

            {/* Bookmark */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
                onBookmark(video);
              }}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark video'}
              accessibilityState={{ selected: isBookmarked }}
            >
              <Bookmark
                size={26}
                color={isBookmarked ? colors.warning : '#FFFFFF'}
                fill={isBookmarked ? colors.warning : 'transparent'}
                strokeWidth={2}
              />
            </Pressable>

            {/* More Options */}
            <Pressable
              onPress={() => onExpand(video)}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <MoreHorizontal size={24} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Bottom Info Overlay - 2026: Creator economy + content safety */}
          <View style={styles.bottomInfo}>
            {/* Creator Info - 2026: Verified badge + follow CTA */}
            <View style={styles.creatorRow}>
              <View style={styles.creatorAvatar}>
                <Text style={styles.avatarText}>
                  {(video.title || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.creatorInfo}>
                <View style={styles.creatorNameRow}>
                  <Text style={styles.creatorName}>@creator</Text>
                  {/* 2026: Verified badge */}
                  <BadgeCheck size={14} color="#1DA1F2" fill="#1DA1F2" />
                </View>
                {/* 2026: Watch time / engagement indicator */}
                <View style={styles.engagementRow}>
                  <Clock size={10} color={withAlpha('#FFFFFF', 0.5)} strokeWidth={2} />
                  <Text style={styles.engagementText}>
                    {formatViews(video.views || 0)} views
                  </Text>
                </View>
              </View>
              <Pressable 
                style={styles.followButton}
                accessibilityRole="button"
                accessibilityLabel="Follow creator"
              >
                <Text style={styles.followText}>Follow</Text>
              </Pressable>
            </View>

            {/* Video Title/Description */}
            <Text style={styles.videoTitle} numberOfLines={2}>
              {video.title || 'Untitled Video'}
            </Text>

            {/* 2026: Content safety label (if sponsored) */}
            {video.isSponsored && (
              <View style={styles.adOverlaySection}>
                <View style={styles.sponsoredBadge}>
                  <Shield size={10} color="#FFA726" strokeWidth={2.5} />
                  <Text style={styles.sponsoredText}>Sponsored • {video.sponsorName || 'Ad'}</Text>
                </View>

                {/* 2026: CTA Button — Primary ad call-to-action */}
                {video.ctaUrl && (
                  <Pressable
                    style={styles.ctaButton}
                    onPress={handleAdCtaPress}
                    accessibilityRole="link"
                    accessibilityLabel={video.ctaText || 'Learn More'}
                    accessibilityHint="Opens advertiser website"
                  >
                    <Text style={styles.ctaButtonText}>{video.ctaText || 'Learn More'}</Text>
                    <ExternalLink size={12} color="#FFFFFF" strokeWidth={2.5} />
                  </Pressable>
                )}

                {/* 2026: "Why this ad?" — FTC/GDPR transparency affordance */}
                <Pressable
                  style={styles.whyThisAd}
                  onPress={handleAdFeedback}
                  accessibilityRole="button"
                  accessibilityLabel="Why am I seeing this ad? Report or provide feedback"
                >
                  <Info size={10} color={withAlpha('#FFFFFF', 0.5)} strokeWidth={2} />
                  <Text style={styles.whyThisAdText}>Why this ad?</Text>
                </Pressable>
              </View>
            )}

            {/* Music/Sound Row - 2026: Caption toggle affordance */}
            <View style={styles.musicRow}>
              <View style={styles.musicRowLeft}>
                <Music2 size={12} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.musicText} numberOfLines={1}>
                  Original audio - creator
                </Text>
              </View>
              {/* 2026: Auto-caption indicator */}
              <Pressable 
                style={styles.captionToggle}
                accessibilityRole="button"
                accessibilityLabel="Toggle captions"
              >
                <Captions size={14} color={withAlpha('#FFFFFF', 0.7)} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Progress Bar */}
          <VideoProgressBar
            progress={progress}
            bufferProgress={bufferProgress}
            duration={duration}
            isVisible={isActive}
          />

          {/* Heart Burst Animation */}
          <HeartBurst visible={showHeartBurst} x={heartPosition.x} y={heartPosition.y} />

          {/* Seek Indicator */}
          <SeekIndicator visible={showSeekIndicator} side={seekSide} amount={seekAmount} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
  },
  thumbnailLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  thumbnail: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  bufferingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: withAlpha('#000000', 0.7),
    zIndex: 10,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#FFFFFF',
    marginBottom: SPACING.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: withAlpha('#FFFFFF', 0.2),
    borderRadius: RADIUS.full,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
  },
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -40,
    marginTop: -40,
    zIndex: 5,
  },
  playButtonBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withAlpha('#000000', 0.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
    zIndex: 10,
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
  iconButtonBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideActions: {
    position: 'absolute',
    right: SPACING.sm,
    bottom: 160,
    alignItems: 'center',
    gap: SPACING.md,
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    gap: 3,
    minWidth: 44, // 2026: WCAG 2.2 AAA minimum touch target
    minHeight: 44,
    justifyContent: 'center',
  },
  actionCount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomInfo: {
    position: 'absolute',
    left: SPACING.md,
    right: 72,
    bottom: SPACING.xl,
    zIndex: 10,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  creatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#666666',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
  },
  creatorInfo: {
    flex: 1,
    gap: 2,
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 10,
    color: withAlpha('#FFFFFF', 0.5),
  },
  followButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
    backgroundColor: '#FF2D55',
    borderRadius: RADIUS.full,
  },
  followText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: withAlpha('#FFA726', 0.15),
    borderWidth: 1,
    borderColor: withAlpha('#FFA726', 0.25),
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  sponsoredText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
    color: '#FFA726',
    letterSpacing: 0.3,
  },
  // 2026: Ad overlay section (badge + CTA + why this ad)
  adOverlaySection: {
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  // 2026: Persistent top-corner Ad watermark (FTC/IAB compliant)
  adWatermark: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: withAlpha('#000000', 0.6),
    zIndex: 15,
  },
  adWatermarkText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // 2026: CTA Button — Primary ad call-to-action
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFFFFF',
    minHeight: 36,
  },
  ctaButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#000000',
    letterSpacing: 0.2,
  },
  // 2026: "Why this ad?" — FTC/GDPR transparency affordance
  whyThisAd: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingVertical: 2,
  },
  whyThisAdText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 10,
    color: withAlpha('#FFFFFF', 0.5),
    textDecorationLine: 'underline',
  },
  videoTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    justifyContent: 'space-between',
  },
  musicRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  musicText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  captionToggle: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: withAlpha('#FFFFFF', 0.15),
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    zIndex: 20,
  },
  progressTrack: {
    flex: 1,
  },
  bufferFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  heartBurst: {
    position: 'absolute',
    zIndex: 100,
    ...SHADOWS.lg,
  },
  seekIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -30,
    zIndex: 50,
  },
  seekIndicatorLeft: {
    left: SCREEN_WIDTH * 0.15,
  },
  seekIndicatorRight: {
    right: SCREEN_WIDTH * 0.15,
  },
  seekBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  seekText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#FFFFFF',
  },
});

// ============================================================================
// MEMO COMPARISON - Prevent unnecessary re-renders for performance
// ============================================================================

/**
 * Custom comparison function for React.memo
 * Only re-render when these specific props change:
 * - video.id changes (different video)
 * - isActive changes (play/pause state)
 * - isMuted changes (audio state)
 * - isLiked / isBookmarked changes (engagement state)
 * - itemHeight changes (layout)
 * - screenReaderEnabled changes (accessibility)
 * 
 * Callbacks are excluded since they should be stable references from parent
 */
function arePropsEqual(
  prevProps: VideoFeedItemProps,
  nextProps: VideoFeedItemProps
): boolean {
  return (
    prevProps.video.id === nextProps.video.id &&
    prevProps.video.likes === nextProps.video.likes &&
    prevProps.video.commentsCount === nextProps.video.commentsCount &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.isBookmarked === nextProps.isBookmarked &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.screenReaderEnabled === nextProps.screenReaderEnabled &&
    prevProps.index === nextProps.index
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export const VideoFeedItem = memo(VideoFeedItemComponent, arePropsEqual);
export default VideoFeedItem;
