/**
 * ProgressBar Component
 * A reusable progress bar with optional interactive seeking
 * 
 * @example
 * ```tsx
 * <ProgressBar
 *   progress={0.5}
 *   onSeek={(value) => setProgress(value)}
 *   showThumb
 *   animated
 * />
 * ```
 */

import React, { memo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  Animated,
  LayoutChangeEvent,
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
  /** Callback when user seeks to a new position */
  onSeek?: (progress: number) => void;
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
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Test ID for testing */
  testID?: string;
}

const SIZE_CONFIG: Record<ProgressBarSize, { height: number; thumbSize: number }> = {
  small: { height: 2, thumbSize: 8 },
  medium: { height: 4, thumbSize: 12 },
  large: { height: 6, thumbSize: 16 },
};

function ProgressBarComponent({
  progress,
  onSeek,
  size = 'medium',
  trackColor,
  fillColor,
  showThumb = false,
  thumbColor,
  animated = false,
  animationDuration = ANIMATION.duration.normal,
  style,
  interactive = true,
  accessibilityLabel = 'Progress bar',
  testID,
}: ProgressBarProps): React.ReactElement {
  const { colors } = useTheme();
  const sizeConfig = SIZE_CONFIG[size];
  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const containerWidth = useRef(0);

  const effectiveTrackColor = trackColor || colors.border;
  const effectiveFillColor = fillColor || colors.primary;
  const effectiveThumbColor = thumbColor || effectiveFillColor;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: animationDuration,
        useNativeDriver: false,
      }).start();
    } else {
      animatedProgress.setValue(progress);
    }
  }, [progress, animated, animationDuration, animatedProgress]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    containerWidth.current = event.nativeEvent.layout.width;
  }, []);

  const handlePress = useCallback(
    (event: { nativeEvent: { locationX: number } }) => {
      if (!interactive || !onSeek || containerWidth.current === 0) return;
      
      const { locationX } = event.nativeEvent;
      const newProgress = Math.max(0, Math.min(1, locationX / containerWidth.current));
      onSeek(newProgress);
    },
    [interactive, onSeek]
  );

  // For non-animated mode, use percentage string
  const fillWidthValue = `${Math.max(0, Math.min(100, progress * 100))}%` as const;

  const Container = interactive && onSeek ? TouchableOpacity : View;

  return (
    <Container
      onLayout={handleLayout}
      onPress={interactive && onSeek ? handlePress : undefined}
      activeOpacity={0.9}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      testID={testID}
      style={[
        styles.container,
        {
          height: interactive ? Math.max(sizeConfig.height * 4, 20) : sizeConfig.height,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.track,
          {
            height: sizeConfig.height,
            backgroundColor: effectiveTrackColor,
            borderRadius: sizeConfig.height / 2,
          },
        ]}
      >
        {animated ? (
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
        {showThumb && !animated && (
          <View
            style={[
              styles.thumb,
              {
                width: sizeConfig.thumbSize,
                height: sizeConfig.thumbSize,
                borderRadius: sizeConfig.thumbSize / 2,
                backgroundColor: effectiveThumbColor,
                left: `${progress * 100}%`,
                marginLeft: -sizeConfig.thumbSize / 2,
                top: (sizeConfig.height - sizeConfig.thumbSize) / 2,
              },
            ]}
          />
        )}
        {showThumb && animated && (
          <Animated.View
            style={[
              styles.thumb,
              {
                width: sizeConfig.thumbSize,
                height: sizeConfig.thumbSize,
                borderRadius: sizeConfig.thumbSize / 2,
                backgroundColor: effectiveThumbColor,
                left: animatedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, containerWidth.current - sizeConfig.thumbSize],
                }),
                top: (sizeConfig.height - sizeConfig.thumbSize) / 2,
              },
            ]}
          />
        )}
      </View>
    </Container>
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
