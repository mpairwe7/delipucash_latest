/**
 * RecordingTimer Component
 * Displays recording time with animated indicator
 * Design System Compliant - Inspired by Instagram/TikTok recording UI
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { SPACING, RADIUS, Z_INDEX } from '@/utils/theme';
import { formatDuration, getResponsiveSize } from '@/utils/video-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordingTimerProps {
  /** Current recording time in seconds */
  currentTime: number;
  /** Maximum recording duration in seconds */
  maxDuration: number;
  /** Whether recording is active */
  isRecording: boolean;
  /** Custom style */
  style?: object;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RecordingTimer = memo<RecordingTimerProps>(({
  currentTime,
  maxDuration,
  isRecording,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Pulsing animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
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

  if (!isRecording) return null;

  const fontSize = getResponsiveSize(12, 14, 16);
  const dotSize = getResponsiveSize(8, 10, 12);
  const containerPadding = getResponsiveSize(8, 12, 16);

  return (
    <View style={[styles.container, { paddingHorizontal: containerPadding }, style]}>
      {/* Recording indicator */}
      <View style={styles.indicatorContainer}>
        <Animated.View
          style={[
            styles.recordingDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <Text style={[styles.recText, { fontSize }]}>REC</Text>
      </View>

      {/* Timer display */}
      <View style={styles.timeContainer}>
        <Text style={[styles.currentTime, { fontSize: fontSize + 2 }]}>
          {formatDuration(currentTime)}
        </Text>
        <Text style={[styles.separator, { fontSize }]}>/</Text>
        <Text style={[styles.maxTime, { fontSize }]}>
          {formatDuration(maxDuration)}
        </Text>
      </View>
    </View>
  );
});

RecordingTimer.displayName = 'RecordingTimer';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: Z_INDEX.fixed,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  recordingDot: {
    backgroundColor: '#FF3B30',
    marginRight: SPACING.xs,
  },
  recText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTime: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  separator: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: SPACING.xxs,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  maxTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
});

export default RecordingTimer;
