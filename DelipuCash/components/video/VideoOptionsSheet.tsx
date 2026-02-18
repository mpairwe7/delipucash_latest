/**
 * VideoOptionsSheet — "More" bottom sheet for video feed items
 *
 * Actions:
 * - Not Interested — removes video from feed + backend feedback
 * - Hide content from this creator — removes all their videos
 * - Report — flags content
 * - Cancel
 *
 * Follows VideoCommentsSheet pattern (reanimated + GestureDetector, state-based visibility).
 *
 * @module components/video/VideoOptionsSheet
 */

import React, { memo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import {
  EyeOff,
  UserX,
  Flag,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
} from '@/utils/theme';
import type { Video } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type VideoOptionsAction = 'not_interested' | 'hide_creator' | 'report';

export interface VideoOptionsSheetProps {
  visible: boolean;
  video: Video | null;
  onClose: () => void;
  onAction: (action: VideoOptionsAction, video: Video) => void;
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = 280;

// ============================================================================
// COMPONENT
// ============================================================================

function VideoOptionsSheetComponent({
  visible,
  video,
  onClose,
  onAction,
  testID,
}: VideoOptionsSheetProps): React.ReactElement | null {
  const { colors } = useTheme();

  // Animation values
  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Animate open/close
  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 250 });
      backdropOpacity.value = withTiming(0.5, { duration: 200 });
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  const handleAction = useCallback(
    (action: VideoOptionsAction) => {
      if (!video) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAction(action, video);
      onClose();
    },
    [video, onAction, onClose],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Swipe down to dismiss
  const panGesture = Gesture.Pan()
    .onEnd((e) => {
      if (e.translationY > 50) {
        runOnJS(handleClose)();
      }
    });

  // Animated styles
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible && !video) return null;

  const options: { action: VideoOptionsAction; icon: typeof EyeOff; label: string; color?: string }[] = [
    { action: 'not_interested', icon: EyeOff, label: 'Not Interested' },
    { action: 'hide_creator', icon: UserX, label: 'Hide content from this creator' },
    { action: 'report', icon: Flag, label: 'Report', color: '#FF3B30' },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }, backdropStyle]} />
      </Pressable>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card },
            sheetStyle,
          ]}
          testID={testID}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Options */}
          {options.map(({ action, icon: Icon, label, color }) => (
            <Pressable
              key={action}
              style={({ pressed }) => [
                styles.option,
                pressed && { opacity: 0.6 },
              ]}
              onPress={() => handleAction(action)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Icon
                size={22}
                color={color || colors.text}
                strokeWidth={1.5}
              />
              <Text style={[styles.optionLabel, { color: color || colors.text }]}>
                {label}
              </Text>
            </Pressable>
          ))}

          {/* Cancel */}
          <Pressable
            style={({ pressed }) => [
              styles.option,
              styles.cancelOption,
              { borderTopColor: colors.border },
              pressed && { opacity: 0.6 },
            ]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <X size={22} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.optionLabel, { color: colors.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: SPACING.xl,
    minHeight: SHEET_HEIGHT,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    minHeight: 48,
  },
  optionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  cancelOption: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.xs,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const VideoOptionsSheet = memo(VideoOptionsSheetComponent);
export default VideoOptionsSheet;
