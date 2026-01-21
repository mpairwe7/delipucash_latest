/**
 * RecordingProgressBar Component
 * Progress bar showing recording duration
 * Design System Compliant
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import { Z_INDEX } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordingProgressBarProps {
  /** Whether recording is in progress */
  isRecording: boolean;
  /** Maximum recording duration in milliseconds */
  maxDuration: number;
  /** Progress bar height */
  height?: number;
  /** Progress bar color */
  color?: string;
  /** Background color */
  backgroundColor?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RecordingProgressBar = memo<RecordingProgressBarProps>(({
  isRecording,
  maxDuration,
  height = 4,
  color = '#FF3B30',
  backgroundColor = 'rgba(255, 255, 255, 0.3)',
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRecording) {
      // Reset and start progress animation
      progressAnim.setValue(0);
      animationRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: maxDuration,
        useNativeDriver: false,
      });
      animationRef.current.start();
    } else {
      // Stop and reset animation
      if (animationRef.current) {
        animationRef.current.stop();
      }
      progressAnim.setValue(0);
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [isRecording, maxDuration, progressAnim]);

  if (!isRecording) return null;

  return (
    <View style={[styles.container, { height, backgroundColor }]}>
      <Animated.View
        style={[
          styles.progress,
          {
            height,
            backgroundColor: color,
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
});

RecordingProgressBar.displayName = 'RecordingProgressBar';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: Z_INDEX.fixed + 1,
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

export default RecordingProgressBar;
