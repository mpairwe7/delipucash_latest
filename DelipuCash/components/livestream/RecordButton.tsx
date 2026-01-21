/**
 * RecordButton Component
 * Main recording button with animated states
 * Design System Compliant - Inspired by TikTok/Instagram capture UI
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SHADOWS } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordButtonProps {
  /** Whether recording is in progress */
  isRecording: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Press handler */
  onPress: () => void;
  /** Long press handler (for hold-to-record) */
  onLongPress?: () => void;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Button style variant */
  variant?: 'default' | 'live';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZES = {
  small: { outer: 60, inner: 46, stop: 18 },
  medium: { outer: 76, inner: 58, stop: 22 },
  large: { outer: 90, inner: 70, stop: 28 },
} as const;

const COLORS = {
  default: {
    outer: 'rgba(255, 255, 255, 0.5)',
    inner: '#FF3B30',
    recording: 'rgba(255, 255, 255, 0.9)',
    recordingBorder: 'rgba(255, 59, 48, 0.5)',
  },
  live: {
    outer: 'rgba(255, 59, 48, 0.3)',
    inner: '#FF3B30',
    recording: 'rgba(255, 255, 255, 0.9)',
    recordingBorder: '#FF3B30',
  },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const RecordButton = memo<RecordButtonProps>(({
  isRecording,
  disabled = false,
  onPress,
  onLongPress,
  size = 'medium',
  variant = 'default',
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const sizeConfig = SIZES[size];
  const colorConfig = COLORS[variant];

  // Pulsing animation when recording
  useEffect(() => {
    if (isRecording) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const handleLongPress = () => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { scale: isRecording ? pulseAnim : scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[
          styles.button,
          {
            width: sizeConfig.outer,
            height: sizeConfig.outer,
            borderRadius: sizeConfig.outer / 2,
            borderColor: isRecording ? colorConfig.recordingBorder : colorConfig.outer,
            backgroundColor: isRecording ? colorConfig.recording : 'transparent',
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {isRecording ? (
          // Stop icon (square)
          <View
            style={[
              styles.stopIcon,
              {
                width: sizeConfig.stop,
                height: sizeConfig.stop,
                borderRadius: 4,
                backgroundColor: colorConfig.inner,
              },
            ]}
          />
        ) : (
          // Record icon (circle)
          <View
            style={[
              styles.recordIcon,
              {
                width: sizeConfig.inner,
                height: sizeConfig.inner,
                borderRadius: sizeConfig.inner / 2,
                backgroundColor: colorConfig.inner,
              },
            ]}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

RecordButton.displayName = 'RecordButton';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.lg,
  },
  recordIcon: {},
  stopIcon: {},
});

export default RecordButton;
