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

import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
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
} from '@/utils/theme';
import { Video } from '@/types';
import { ProgressBar } from '../ui/ProgressBar';

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
      <TouchableOpacity
        onPress={onExpand}
        activeOpacity={0.95}
        style={[styles.player, { backgroundColor: colors.card }]}
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
            <Image
              source={{ uri: video.thumbnail }}
              style={styles.thumbnailImage}
              accessibilityIgnoresInvertColors
            />
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
            <TouchableOpacity
              onPress={handlePlayPause}
              style={[styles.controlButton, { backgroundColor: colors.background }]}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              accessibilityRole="button"
            >
              {isPlaying ? (
                <Pause size={ICON_SIZE.base} color={colors.text} fill={colors.text} />
              ) : (
                <Play size={ICON_SIZE.base} color={colors.text} fill={colors.text} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.controlButton, { backgroundColor: colors.background }]}
              accessibilityLabel="Close mini player"
              accessibilityRole="button"
            >
              <X size={ICON_SIZE.base} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
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
  },
});

export const MiniPlayer = memo(MiniPlayerComponent);
