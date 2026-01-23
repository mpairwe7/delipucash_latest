/**
 * ProgressBar Component
 * A reusable progress bar with optional interactive seeking and buffering
 * 
 * @example
 * ```tsx
 * <ProgressBar
 *   progress={0.5}
 *   onSeek={(value) => setProgress(value)}
 *   showThumb
 *   animated
 *   bufferedProgress={0.7}
 * />
 * ```
 */

import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
  Animated,
  LayoutChangeEvent,
  PanResponder,
} from 'react-native';
import {
  useTheme,
  ANIMATION,
} from '@/utils/theme';

/**
 * Progress bar size variants
 */
export type ProgressBarSize = 'small' | 'medium' | 'large';

/**
 * Props for the ProgressBar component
 */
export interface ProgressBarProps {
  /** Progress value between 0 and 1 */
  progress: number;
  /** Callback when user seeks to a new position (on release) */
  onSeek?: (progress: number) => void;
  /** Callback when seeking starts */
  onSeekStart?: () => void;
  /** Callback during seeking with current preview position */
  onSeeking?: (progress: number) => void;
  /** Size variant */
  size?: ProgressBarSize;
  /** Track color (default: uses theme muted color) */
  trackColor?: string;
  /** Fill color (default: uses theme primary color) */
  fillColor?: string;
  /** Whether to show the thumb indicator */
  showThumb?: boolean;
  /** Thumb color (default: uses fillColor) */
  thumbColor?: string;
  /** Whether to animate progress changes */
  animated?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Custom container style */
  style?: ViewStyle;
  /** Whether the progress bar is interactive */
  interactive?: boolean;
  /** Buffered progress value between 0 and 1 */
  bufferedProgress?: number;
  /** Buffered progress color */
  bufferedColor?: string;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Test ID for testing */
  testID?: string;
}

const SIZE_CONFIG: Record<ProgressBarSize, { height: number; thumbSize: number; activeThumbSize: number }> = {
  small: { height: 2, thumbSize: 8, activeThumbSize: 12 },
  medium: { height: 4, thumbSize: 12, activeThumbSize: 18 },
  large: { height: 6, thumbSize: 16, activeThumbSize: 24 },
};

function ProgressBarComponent({
  progress,
  onSeek,
  onSeekStart,
  onSeeking,
  size = 'medium',
  trackColor,
  fillColor,
  showThumb = false,
  thumbColor,
  animated = false,
  animationDuration = ANIMATION.duration.normal,
  style,
  interactive = true,
  bufferedProgress = 0,
  bufferedColor,
  accessibilityLabel = 'Progress bar',
  testID,
}: ProgressBarProps): React.ReactElement {
  const { colors } = useTheme();
  const sizeConfig = SIZE_CONFIG[size];
  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const containerWidth = useRef(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekProgress, setSeekProgress] = useState(progress);

  const effectiveTrackColor = trackColor || colors.border;
  const effectiveFillColor = fillColor || colors.primary;
  const effectiveThumbColor = thumbColor || effectiveFillColor;
  const effectiveBufferedColor = bufferedColor || `${effectiveFillColor}50`;

  // Current thumb size (larger when seeking)
  const currentThumbSize = isSeeking ? sizeConfig.activeThumbSize : sizeConfig.thumbSize;

  useEffect(() => {
    if (!isSeeking) {
      if (animated) {
        Animated.timing(animatedProgress, {
          toValue: progress,
          duration: animationDuration,
          useNativeDriver: false,
        }).start();
      } else {
        animatedProgress.setValue(progress);
      }
      setSeekProgress(progress);
    }
  }, [progress, animated, animationDuration, animatedProgress, isSeeking]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    containerWidth.current = event.nativeEvent.layout.width;
  }, []);

  // Calculate progress from touch position
  const calculateProgress = useCallback((locationX: number): number => {
    if (containerWidth.current === 0) return 0;
    return Math.max(0, Math.min(1, locationX / containerWidth.current));
  }, []);

  // Pan responder for smooth seeking
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => interactive && !!onSeek,
      onMoveShouldSetPanResponder: () => interactive && !!onSeek,
      onPanResponderGrant: (event) => {
        if (!interactive || !onSeek) return;
        setIsSeeking(true);
        onSeekStart?.();
        const newProgress = calculateProgress(event.nativeEvent.locationX);
        setSeekProgress(newProgress);
        onSeeking?.(newProgress);
      },
      onPanResponderMove: (event) => {
        if (!interactive || !onSeek || !isSeeking) return;
        const newProgress = calculateProgress(event.nativeEvent.locationX);
        setSeekProgress(newProgress);
        onSeeking?.(newProgress);
      },
      onPanResponderRelease: (event) => {
        if (!interactive || !onSeek) return;
        const newProgress = calculateProgress(event.nativeEvent.locationX);
        setIsSeeking(false);
        onSeek(newProgress);
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
      },
    })
  ).current;

  // Progress to display (either current progress or seek preview)
  const displayProgress = isSeeking ? seekProgress : progress;
  const fillWidthValue = `${Math.max(0, Math.min(100, displayProgress * 100))}%` as const;
  const bufferedWidthValue = `${Math.max(0, Math.min(100, bufferedProgress * 100))}%` as const;

  return (
    <View
      onLayout={handleLayout}
      {...(interactive && onSeek ? panResponder.panHandlers : {})}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      testID={testID}
      style={[
        styles.container,
        {
          height: interactive ? Math.max(sizeConfig.height * 4, 24) : sizeConfig.height,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.track,
          {
            height: isSeeking ? sizeConfig.height * 1.5 : sizeConfig.height,
            backgroundColor: effectiveTrackColor,
            borderRadius: sizeConfig.height / 2,
          },
        ]}
      >
        {/* Buffered progress */}
        {bufferedProgress > 0 && (
          <View
            style={[
              styles.fill,
              {
                width: bufferedWidthValue,
                backgroundColor: effectiveBufferedColor,
                borderRadius: sizeConfig.height / 2,
              },
            ]}
          />
        )}

        {/* Main progress fill */}
        {animated && !isSeeking ? (
          <Animated.View
            style={[
              styles.fill,
              {
                width: animatedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: effectiveFillColor,
                borderRadius: sizeConfig.height / 2,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.fill,
              {
                width: fillWidthValue,
                backgroundColor: effectiveFillColor,
                borderRadius: sizeConfig.height / 2,
              },
            ]}
          />
        )}

        {/* Thumb */}
        {showThumb && (
          <View
            style={[
              styles.thumb,
              {
                width: currentThumbSize,
                height: currentThumbSize,
                borderRadius: currentThumbSize / 2,
                backgroundColor: effectiveThumbColor,
                left: `${displayProgress * 100}%`,
                marginLeft: -currentThumbSize / 2,
                top: ((isSeeking ? sizeConfig.height * 1.5 : sizeConfig.height) - currentThumbSize) / 2,
                // Add shadow when seeking for depth
                ...(isSeeking && {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 3,
                  elevation: 5,
                }),
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    position: 'absolute',
  },
});

export const ProgressBar = memo(ProgressBarComponent);
