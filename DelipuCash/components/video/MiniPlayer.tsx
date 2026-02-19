/**
 * MiniPlayer Component
 * A sticky mini player that shows when the full player is collapsed
 * 
 * @example
 * ```tsx
 * <MiniPlayer
 *   video={currentVideo}
 *   isPlaying={isPlaying}
 *   progress={0.5}
 *   onPlayPause={handlePlayPause}
 *   onClose={handleClose}
 *   onExpand={handleExpand}
 * />
 * ```
 */

import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Play, Pause, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  Z_INDEX,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { Video } from '@/types';
import { ProgressBar } from '../ui/ProgressBar';
import { getBestThumbnailUrl, getPlaceholderImage } from '@/utils/thumbnail-utils';

/**
 * Props for the MiniPlayer component
 */
export interface MiniPlayerProps {
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
  /** Bottom offset from safe area */
  bottomOffset?: number;
  /** Test ID for testing */
  testID?: string;
}

function MiniPlayerComponent({
  video,
  isPlaying,
  progress,
  onPlayPause,
  onClose,
  onExpand,
  bottomOffset = SPACING.base,
  testID,
}: MiniPlayerProps): React.ReactElement {
  const { colors } = useTheme();

  // Thumbnail state with fallback handling
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(video.thumbnail || null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);

  // Load best available thumbnail
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
        } catch (error) {
          if (__DEV__) console.error('[MiniPlayer] Failed to generate thumbnail:', error);
          setThumbnailUrl(getPlaceholderImage('video'));
        } finally {
          setIsLoadingThumbnail(false);
        }
      } else {
        setThumbnailUrl(getPlaceholderImage('video'));
      }
    };

    loadThumbnail();
  }, [video.thumbnail, video.videoUrl]);

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPause();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          ...SHADOWS.md,
        },
      ]}
    >
      <Pressable
        onPress={onExpand}
        style={({ pressed }) => [styles.player, { backgroundColor: colors.card }, pressed && { opacity: 0.95 }]}
        accessibilityRole="button"
        accessibilityLabel={`Now playing: ${video.title}. Tap to expand`}
      >
        {/* Progress indicator */}
        <View style={[styles.progress, { backgroundColor: colors.border }]}>
          <ProgressBar
            progress={progress}
            size="small"
            trackColor={colors.border}
            fillColor={colors.primary}
            interactive={false}
            style={styles.progressBar}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Thumbnail */}
          <View style={styles.thumbnail}>
            {isLoadingThumbnail ? (
              <View style={[styles.thumbnailImage, styles.loadingContainer, { backgroundColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
                <Image
                  source={{ uri: thumbnailUrl || getPlaceholderImage('video') }}
                  style={styles.thumbnailImage}
                  accessibilityIgnoresInvertColors
                />
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
            >
              {video.title || 'Untitled Video'}
            </Text>
            <Text
              style={[styles.author, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {'Video Author'}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <Pressable
              onPress={handlePlayPause}
              style={({ pressed }) => [styles.controlButton, { backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              accessibilityRole="button"
            >
              {isPlaying ? (
                <Pause size={ICON_SIZE.base} color={colors.text} fill={colors.text} />
              ) : (
                <Play size={ICON_SIZE.base} color={colors.text} fill={colors.text} />
              )}
            </Pressable>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.controlButton, { backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Close mini player"
              accessibilityRole="button"
            >
              <X size={ICON_SIZE.base} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.base,
    right: SPACING.base,
    zIndex: Z_INDEX.sticky,
  },
  player: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  progress: {
    height: 2,
  },
  progressBar: {
    height: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  thumbnail: {
    width: 80,
    height: 45,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  author: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  controls: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  controlButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.full,
    minWidth: COMPONENT_SIZE.touchTarget,
    minHeight: COMPONENT_SIZE.touchTarget,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const MiniPlayer = memo(MiniPlayerComponent);
