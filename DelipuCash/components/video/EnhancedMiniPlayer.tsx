/**
 * EnhancedMiniPlayer Component
 * YouTube-like floating mini player with gestures and animations
 * 
 * Features:
 * - Smooth slide-in/out animations
 * - Swipe down to dismiss
 * - Swipe up to expand
 * - Progress indicator
 * - Play/pause/close controls
 * - Smooth transition from full player
 * - Accessibility support
 * 
 * @example
 * ```tsx
 * <EnhancedMiniPlayer
 *   video={currentVideo}
 *   isPlaying={isPlaying}
 *   progress={0.5}
 *   onPlayPause={handlePlayPause}
 *   onClose={handleClose}
 *   onExpand={handleExpand}
 * />
 * ```
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Play,
  Pause,
  X,
  ChevronUp,
  SkipForward,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  Z_INDEX,
  ICON_SIZE,
  withAlpha,
} from '@/utils/theme';
import { Video } from '@/types';
import { getBestThumbnailUrl, getPlaceholderImage } from '@/utils/thumbnail-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MINI_PLAYER_HEIGHT = 64;
const SWIPE_THRESHOLD = 50;
const DISMISS_VELOCITY = 500;

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancedMiniPlayerProps {
  /** Video data */
  video: Video;
  /** Whether video is currently playing */
  isPlaying: boolean;
  /** Progress value 0-1 */
  progress: number;
  /** Play/pause toggle handler */
  onPlayPause: () => void;
  /** Close handler */
  onClose: () => void;
  /** Expand to full player handler */
  onExpand: () => void;
  /** Skip to next video handler */
  onSkipNext?: () => void;
  /** Bottom offset from safe area */
  bottomOffset?: number;
  /** Test ID */
  testID?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

function EnhancedMiniPlayerComponent({
  video,
  isPlaying,
  progress,
  onPlayPause,
  onClose,
  onExpand,
  onSkipNext,
  bottomOffset = SPACING.base,
  testID,
}: EnhancedMiniPlayerProps): React.ReactElement {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Animation values
  const translateY = useSharedValue(MINI_PLAYER_HEIGHT + 100); // Start off screen
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  // Local state
  const [thumbnailUrl, setThumbnailUrl] = useState(video.thumbnail);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);

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

  // Animate in on mount
  useEffect(() => {
    translateY.value = withSpring(0, {
      damping: 20,
      stiffness: 300,
    });
    opacity.value = withTiming(1, { duration: 200 });
  }, [translateY, opacity]);

  // Update progress animation
  useEffect(() => {
    progressWidth.value = withTiming(progress * 100, { duration: 100 });
  }, [progress, progressWidth]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate out before closing
    translateY.value = withTiming(MINI_PLAYER_HEIGHT + 100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 });
    
    setTimeout(onClose, 200);
  }, [translateY, opacity, onClose]);

  const handleExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate scale up before expanding
    scale.value = withTiming(1.02, { duration: 100 });
    
    setTimeout(() => {
      scale.value = withTiming(1, { duration: 50 });
      onExpand();
    }, 100);
  }, [scale, onExpand]);

  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPause();
  }, [onPlayPause]);

  const handleSkipNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkipNext?.();
  }, [onSkipNext]);

  // ============================================================================
  // GESTURE HANDLER (Reanimated v3 Gesture API)
  // ============================================================================

  const startY = useSharedValue(0);
  const startX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // Vertical swipe (dismiss or expand)
      translateY.value = startY.value + event.translationY;
      
      // Horizontal swipe (dismiss to side)
      translateX.value = startX.value + event.translationX * 0.5;
      
      // Scale down slightly while dragging
      const dragDistance = Math.abs(event.translationY) + Math.abs(event.translationX);
      scale.value = interpolate(
        dragDistance,
        [0, 100],
        [1, 0.95],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      // Check for vertical swipe gestures
      if (event.translationY > SWIPE_THRESHOLD || event.velocityY > DISMISS_VELOCITY) {
        // Swipe down - dismiss
        translateY.value = withTiming(MINI_PLAYER_HEIGHT + 100, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else if (event.translationY < -SWIPE_THRESHOLD || event.velocityY < -DISMISS_VELOCITY) {
        // Swipe up - expand
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        runOnJS(handleExpand)();
      } else if (
        Math.abs(event.translationX) > SWIPE_THRESHOLD * 1.5 ||
        Math.abs(event.velocityX) > DISMISS_VELOCITY
      ) {
        // Horizontal swipe - dismiss
        const direction = event.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(SCREEN_WIDTH * direction, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        // Spring back to position
        translateY.value = withSpring(0, { damping: 20 });
        translateX.value = withSpring(0, { damping: 20 });
        scale.value = withSpring(1);
      }
    });

  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          testID={testID}
          style={[
            styles.container,
            containerStyle,
            {
              bottom: bottomOffset + insets.bottom,
              backgroundColor: colors.card,
              ...SHADOWS.lg,
            },
          ]}
        >
        {/* Progress bar at top */}
        <View style={[styles.progressContainer, { backgroundColor: withAlpha(colors.primary, 0.2) }]}>
          <Animated.View
            style={[styles.progressFill, progressStyle, { backgroundColor: colors.primary }]}
          />
        </View>

        <Pressable
          onPress={handleExpand}
          style={styles.content}
          accessibilityRole="button"
          accessibilityLabel={`Now playing: ${video.title || 'Video'}. Tap to expand, swipe down to dismiss`}
        >
          {/* Thumbnail */}
          <View style={styles.thumbnailContainer}>
            {isLoadingThumbnail ? (
              <View style={[styles.thumbnail, styles.loadingContainer, { backgroundColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <Image
                source={{ uri: thumbnailUrl || getPlaceholderImage('video') }}
                style={styles.thumbnail}
                accessibilityIgnoresInvertColors
              />
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {video.title || 'Untitled Video'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              Tap to expand • Swipe to dismiss
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Play/Pause */}
            <Pressable
              onPress={handlePlayPause}
              style={styles.controlButton}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={ICON_SIZE.lg} color={colors.text} fill={colors.text} />
              ) : (
                <Play size={ICON_SIZE.lg} color={colors.text} fill={colors.text} />
              )}
            </Pressable>

            {/* Skip Next */}
            {onSkipNext && (
              <Pressable
                onPress={handleSkipNext}
                style={styles.controlButton}
                accessibilityRole="button"
                accessibilityLabel="Skip to next video"
              >
                <SkipForward size={ICON_SIZE.md} color={colors.text} />
              </Pressable>
            )}

            {/* Close */}
            <Pressable
              onPress={handleClose}
              style={styles.controlButton}
              accessibilityRole="button"
              accessibilityLabel="Close mini player"
            >
              <X size={ICON_SIZE.md} color={colors.textMuted} />
            </Pressable>
          </View>
        </Pressable>

        {/* Expand hint indicator */}
        <View style={styles.expandHint}>
          <ChevronUp size={16} color={colors.textMuted} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({\n  container: {
    position: 'absolute',
    left: SPACING.sm,
    right: SPACING.sm,
    height: MINI_PLAYER_HEIGHT,
    borderRadius: RADIUS.lg,
    zIndex: Z_INDEX.fixed,
    overflow: 'hidden',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingTop: 3, // Account for progress bar
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: SPACING.sm,
    marginRight: SPACING.sm,
    justifyContent: 'center',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.3,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandHint: {
    position: 'absolute',
    top: 3,
    left: '50%',
    marginLeft: -8,
    opacity: 0.5,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const EnhancedMiniPlayer = memo(EnhancedMiniPlayerComponent);
export default EnhancedMiniPlayer;
