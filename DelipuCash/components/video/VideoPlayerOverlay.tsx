/**
 * Video Player Overlay Component
 * Full-screen video player controls with progress bar, actions, and animations
 * 
 * @example
 * ```tsx
 * <VideoPlayerOverlay
 *   video={currentVideo}
 *   isPlaying={isPlaying}
 *   progress={0.5}
 *   onPlayPause={handlePlayPause}
 *   onClose={handleClose}
 * />
 * ```
 */

import React, { memo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import {
  X,
  Share2,
  MoreVertical,
  Play,
  Pause,
  VolumeX,
  Volume2,
  Heart,
  Maximize2,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  ICON_SIZE,
  ANIMATION,
  Z_INDEX,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { Video } from '@/types';
import { IconButton } from '../ui/IconButton';
import { ProgressBar } from '../ui/ProgressBar';

/**
 * Props for the VideoPlayerOverlay component
 */
export interface VideoPlayerOverlayProps {
  /** Video data */
  video: Video;
  /** Whether video is currently playing */
  isPlaying: boolean;
  /** Whether video is muted */
  isMuted: boolean;
  /** Progress value 0-1 */
  progress: number;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Play/pause toggle handler */
  onPlayPause: () => void;
  /** Mute toggle handler */
  onMute: () => void;
  /** Seek handler */
  onSeek: (progress: number) => void;
  /** Close handler */
  onClose: () => void;
  /** Share handler */
  onShare: () => void;
  /** Like handler */
  onLike: () => void;
  /** Whether controls are visible */
  visible: boolean;
  /** Whether video is liked/bookmarked */
  isLiked?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
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
 * Format views count to human readable string
 */
const formatViews = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

/**
 * Format date to relative time string
 */
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
};

function VideoPlayerOverlayComponent({
  video,
  isPlaying,
  isMuted,
  progress,
  currentTime,
  duration,
  onPlayPause,
  onMute,
  onSeek,
  onClose,
  onShare,
  onLike,
  visible,
  isLiked = false,
  testID,
}: VideoPlayerOverlayProps): React.ReactElement | null {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: ANIMATION.duration.normal,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.overlay,
        { opacity: fadeAnim, backgroundColor: withAlpha('#000000', 0.5) },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Top controls */}
      <View style={styles.topControls}>
        <IconButton
          icon={<X size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />}
          onPress={onClose}
          variant="ghost"
          backgroundColor={withAlpha(colors.card, 0.8)}
          accessibilityLabel="Close video player"
        />
        <View style={styles.topRight}>
          <IconButton
            icon={<Share2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />}
            onPress={onShare}
            variant="ghost"
            backgroundColor={withAlpha(colors.card, 0.8)}
            accessibilityLabel="Share video"
          />
          <IconButton
            icon={<MoreVertical size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />}
            onPress={() => {}}
            variant="ghost"
            backgroundColor={withAlpha(colors.card, 0.8)}
            accessibilityLabel="More options"
          />
        </View>
      </View>

      {/* Center play/pause */}
      <Pressable
        onPress={onPlayPause}
        style={({ pressed }) => [styles.centerPlayButton, { backgroundColor: withAlpha(colors.primary, 0.9) }, pressed && { opacity: 0.7 }]}
        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
        accessibilityRole="button"
      >
        {isPlaying ? (
          <Pause size={32} color={colors.primaryText} fill={colors.primaryText} />
        ) : (
          <Play size={32} color={colors.primaryText} fill={colors.primaryText} />
        )}
      </Pressable>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {video.title || 'Untitled Video'}
          </Text>
          <Text style={styles.meta}>
            {formatViews(video.views)} views • {formatTimeAgo(video.createdAt)}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
          <View style={styles.progressWrapper}>
            <ProgressBar
              progress={progress}
              onSeek={onSeek}
              size="medium"
              showThumb
              trackColor={withAlpha('#FFFFFF', 0.3)}
              fillColor={colors.primary}
              accessibilityLabel="Video progress"
            />
          </View>
          <Text style={styles.timeText}>{formatDuration(duration)}</Text>
        </View>

        {/* Bottom actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={onMute}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
            accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
            accessibilityRole="button"
          >
            {isMuted ? (
              <VolumeX size={ICON_SIZE.lg} color="#FFFFFF" strokeWidth={2} />
            ) : (
              <Volume2 size={ICON_SIZE.lg} color="#FFFFFF" strokeWidth={2} />
            )}
          </Pressable>
          <Pressable
            onPress={onLike}
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Like video"
            accessibilityRole="button"
          >
            <Heart
              size={ICON_SIZE.lg}
              color="#FFFFFF"
              strokeWidth={2}
              fill={isLiked ? colors.error : 'transparent'}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Fullscreen"
            accessibilityRole="button"
          >
            <Maximize2 size={ICON_SIZE.lg} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: SPACING.lg,
    zIndex: Z_INDEX.modal,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: SPACING['2xl'],
  },
  topRight: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  centerPlayButton: {
    alignSelf: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.full,
  },
  bottomControls: {
    gap: SPACING.md,
    paddingBottom: SPACING['2xl'],
  },
  info: {
    gap: SPACING.xs,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    color: '#FFFFFF',
  },
  meta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: withAlpha('#FFFFFF', 0.8),
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
    color: '#FFFFFF',
    minWidth: 40,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: SPACING.lg,
  },
  actionButton: {
    padding: SPACING.sm,
    minWidth: COMPONENT_SIZE.touchTarget,
    minHeight: COMPONENT_SIZE.touchTarget,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

export const VideoPlayerOverlay = memo(VideoPlayerOverlayComponent);
