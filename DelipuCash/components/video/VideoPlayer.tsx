/**
 * VideoPlayer Component
 * Full-screen modal video player with controls, accessibility features, and animations
 * 
 * Features:
 * - Expo Video integration with play/pause, seek, volume controls
 * - Accessibility labels and roles for screen readers
 * - Haptic feedback on interactions
 * - Animated control visibility with auto-hide
 * - Progress bar with seek functionality
 * - Picture-in-picture and fullscreen support
 * 
 * @example
 * ```tsx
 * <VideoPlayer
 *   videoSource="https://example.com/video.mp4"
 *   videoDetails={videoData}
 *   onClose={() => setPlayerVisible(false)}
 * />
 * ```
 */

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Animated,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Haptics from 'expo-haptics';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Share2,
  Heart,
  Eye,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  ANIMATION,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { Video } from '@/types';
import { ProgressBar } from '../ui/ProgressBar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Control visibility timeout
const CONTROLS_HIDE_DELAY = 3000;

// Skip duration in seconds
const SKIP_DURATION = 10;

/**
 * Props for the VideoPlayer component
 */
export interface VideoPlayerProps {
  /** Video source URL */
  videoSource: string | null;
  /** Video metadata */
  videoDetails: Video | null;
  /** Callback when player is closed */
  onClose: () => void;
  /** Callback when video is liked */
  onLike?: () => void;
  /** Callback when video is shared */
  onShare?: () => void;
  /** Whether video is already liked */
  isLiked?: boolean;
  /** Auto-play video when opened */
  autoPlay?: boolean;
  /** Enable looping */
  loop?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Format seconds to MM:SS or HH:MM:SS display
 */
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format number to human-readable string (K, M, B)
 */
const formatCount = (count: number): string => {
  if (count >= 1000000000) return `${(count / 1000000000).toFixed(1)}B`;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

/**
 * VideoPlayer Component
 * Full-featured modal video player
 */
function VideoPlayerComponent({
  videoSource,
  videoDetails,
  onClose,
  onLike,
  onShare,
  isLiked = false,
  autoPlay = true,
  loop = true,
  testID,
}: VideoPlayerProps): React.ReactElement | null {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Playback state
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize video player
  const player = useVideoPlayer(videoSource || '', (playerInstance) => {
    playerInstance.loop = loop;
    if (autoPlay) {
      playerInstance.play();
    }
  });

  // Subscribe to player events
  useEffect(() => {
    if (!player) return;

    const handleTimeUpdate = () => {
      const current = player.currentTime || 0;
      const total = player.duration || 0;
      setCurrentTime(current);
      setDuration(total);
      setIsLoading(false);
      if (total > 0) {
        setProgress(current / total);
      }
    };

    // Check status periodically
    const interval = setInterval(() => {
      if (player) {
        handleTimeUpdate();
        setIsPlaying(player.playing);
      }
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [player]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      player?.pause();
    };
  }, [player]);

  // Auto-hide controls
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: ANIMATION.duration.slow,
          useNativeDriver: true,
        }).start(() => setControlsVisible(false));
      }, CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying, controlsOpacity]);

  // Show controls
  const showControls = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: ANIMATION.duration.normal,
      useNativeDriver: true,
    }).start();
    scheduleHideControls();
  }, [controlsOpacity, scheduleHideControls]);

  // Toggle controls visibility
  const handleScreenTap = useCallback(() => {
    if (controlsVisible) {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: ANIMATION.duration.normal,
        useNativeDriver: true,
      }).start(() => setControlsVisible(false));
    } else {
      showControls();
    }
  }, [controlsVisible, controlsOpacity, showControls]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      player?.pause();
    } else {
      player?.play();
    }
    setIsPlaying(!isPlaying);
    showControls();
  }, [isPlaying, player, showControls]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player) {
      player.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    showControls();
  }, [isMuted, player, showControls]);

  // Seek to position
  const handleSeek = useCallback((seekProgress: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player && duration > 0) {
      const seekTime = seekProgress * duration;
      player.currentTime = seekTime;
      setCurrentTime(seekTime);
      setProgress(seekProgress);
    }
    showControls();
  }, [player, duration, showControls]);

  // Skip forward
  const skipForward = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player && duration > 0) {
      const newTime = Math.min(currentTime + SKIP_DURATION, duration);
      player.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(newTime / duration);
    }
    showControls();
  }, [player, currentTime, duration, showControls]);

  // Skip backward
  const skipBackward = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player) {
      const newTime = Math.max(currentTime - SKIP_DURATION, 0);
      player.currentTime = newTime;
      setCurrentTime(newTime);
      if (duration > 0) {
        setProgress(newTime / duration);
      }
    }
    showControls();
  }, [player, currentTime, duration, showControls]);

  // Handle close
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    player?.pause();
    onClose();
  }, [player, onClose]);

  // Handle like
  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLike?.();
    showControls();
  }, [onLike, showControls]);

  // Handle share
  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onShare?.();
    showControls();
  }, [onShare, showControls]);

  // Don't render if no video source
  if (!videoSource) return null;

  return (
    <Modal
      visible={!!videoSource}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
      testID={testID}
    >
      <StatusBar hidden />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Video View */}
        <TouchableWithoutFeedback
          onPress={handleScreenTap}
          accessibilityLabel="Tap to toggle controls"
          accessibilityHint="Shows or hides video player controls"
        >
          <View style={styles.videoContainer}>
            <VideoView
              style={styles.video}
              player={player}
              allowsFullscreen
              allowsPictureInPicture
              contentFit="contain"
              nativeControls={false}
            />

            {/* Loading Indicator */}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                  Loading video...
                </Text>
              </View>
            )}

            {/* Error State */}
            {hasError && (
              <View style={styles.errorOverlay}>
                <Text style={[styles.errorText, { color: colors.error }]}>
                  Failed to load video
                </Text>
                <TouchableOpacity
                  onPress={handleClose}
                  style={[styles.errorButton, { backgroundColor: colors.primary }]}
                  accessibilityLabel="Close video player"
                  accessibilityRole="button"
                >
                  <Text style={[styles.errorButtonText, { color: colors.primaryText }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Controls Overlay */}
            <Animated.View
              style={[
                styles.controlsOverlay,
                {
                  opacity: controlsOpacity,
                  paddingTop: insets.top + SPACING.md,
                  paddingBottom: insets.bottom + SPACING.md,
                },
              ]}
              pointerEvents={controlsVisible ? 'auto' : 'none'}
            >
              {/* Top Bar */}
              <View style={styles.topBar}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={[styles.iconButton, { backgroundColor: withAlpha(colors.card, 0.8) }]}
                  accessibilityLabel="Close video player"
                  accessibilityRole="button"
                  accessibilityHint="Returns to previous screen"
                >
                  <X size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>

                <View style={styles.topActions}>
                  <TouchableOpacity
                    onPress={handleShare}
                    style={[styles.iconButton, { backgroundColor: withAlpha(colors.card, 0.8) }]}
                    accessibilityLabel="Share video"
                    accessibilityRole="button"
                  >
                    <Share2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Center Controls */}
              <View style={styles.centerControls}>
                <TouchableOpacity
                  onPress={skipBackward}
                  style={[styles.skipButton, { backgroundColor: withAlpha(colors.card, 0.6) }]}
                  accessibilityLabel="Skip backward 10 seconds"
                  accessibilityRole="button"
                >
                  <SkipBack size={ICON_SIZE.xl} color={colors.text} strokeWidth={2} />
                  <Text style={[styles.skipText, { color: colors.text }]}>10</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={[styles.playButton, { backgroundColor: withAlpha(colors.primary, 0.9) }]}
                  accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPlaying }}
                >
                  {isPlaying ? (
                    <Pause size={ICON_SIZE['3xl']} color={colors.primaryText} fill={colors.primaryText} />
                  ) : (
                    <Play size={ICON_SIZE['3xl']} color={colors.primaryText} fill={colors.primaryText} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={skipForward}
                  style={[styles.skipButton, { backgroundColor: withAlpha(colors.card, 0.6) }]}
                  accessibilityLabel="Skip forward 10 seconds"
                  accessibilityRole="button"
                >
                  <SkipForward size={ICON_SIZE.xl} color={colors.text} strokeWidth={2} />
                  <Text style={[styles.skipText, { color: colors.text }]}>10</Text>
                </TouchableOpacity>
              </View>

              {/* Bottom Controls */}
              <View style={styles.bottomControls}>
                {/* Video Info */}
                <View style={styles.videoInfo}>
                  <Text
                    style={[styles.videoTitle, { color: colors.text }]}
                    numberOfLines={2}
                    accessibilityRole="header"
                  >
                    {videoDetails?.title || 'Untitled Video'}
                  </Text>
                  <View style={styles.videoStats}>
                    <View style={styles.statItem}>
                      <Heart
                        size={ICON_SIZE.sm}
                        color={colors.textMuted}
                        strokeWidth={2}
                      />
                      <Text style={[styles.statText, { color: colors.textMuted }]}>
                        {formatCount(videoDetails?.likes || 0)}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Eye
                        size={ICON_SIZE.sm}
                        color={colors.textMuted}
                        strokeWidth={2}
                      />
                      <Text style={[styles.statText, { color: colors.textMuted }]}>
                        {formatCount(videoDetails?.views || 0)} views
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <Text
                    style={[styles.timeText, { color: colors.text }]}
                    accessibilityLabel={`Current time: ${formatDuration(currentTime)}`}
                  >
                    {formatDuration(currentTime)}
                  </Text>
                  <View style={styles.progressWrapper}>
                    <ProgressBar
                      progress={progress}
                      onSeek={handleSeek}
                      size="medium"
                      showThumb
                      trackColor={withAlpha(colors.text, 0.3)}
                      fillColor={colors.primary}
                      accessibilityLabel={`Video progress: ${Math.round(progress * 100)}%`}
                    />
                  </View>
                  <Text
                    style={[styles.timeText, { color: colors.text }]}
                    accessibilityLabel={`Total duration: ${formatDuration(duration)}`}
                  >
                    {formatDuration(duration)}
                  </Text>
                </View>

                {/* Action Bar */}
                <View style={styles.actionBar}>
                  <TouchableOpacity
                    onPress={toggleMute}
                    style={styles.actionButton}
                    accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isMuted }}
                  >
                    {isMuted ? (
                      <VolumeX size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                    ) : (
                      <Volume2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleLike}
                    style={styles.actionButton}
                    accessibilityLabel={isLiked ? 'Unlike video' : 'Like video'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isLiked }}
                  >
                    <Heart
                      size={ICON_SIZE.lg}
                      color={isLiked ? colors.error : colors.text}
                      fill={isLiked ? colors.error : 'transparent'}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIsFullscreen(!isFullscreen)}
                    style={styles.actionButton}
                    accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isFullscreen }}
                  >
                    {isFullscreen ? (
                      <Minimize2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                    ) : (
                      <Maximize2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    gap: SPACING.lg,
    padding: SPACING.xl,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
  },
  errorButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.base,
  },
  errorButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING['2xl'],
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: -SPACING.xs,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    gap: SPACING.md,
  },
  videoInfo: {
    gap: SPACING.xs,
  },
  videoTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    lineHeight: TYPOGRAPHY.fontSize.xl * TYPOGRAPHY.lineHeight.normal,
  },
  videoStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressWrapper: {
    flex: 1,
  },
  timeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 45,
    textAlign: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: SPACING.lg,
  },
  actionButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const VideoPlayer = memo(VideoPlayerComponent);
export default VideoPlayer;
