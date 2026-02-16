/**
 * StreamHealthBadge Component
 * Shows a colored indicator for livestream/recording health
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/utils/theme';
import type { LivestreamStatus } from '@/store/VideoStore';

export type UploadHealth = 'good' | 'slow' | 'error';

export interface StreamHealthBadgeProps {
  /** Current livestream status */
  status: LivestreamStatus;
  /** Upload health indicator */
  uploadHealth?: UploadHealth;
}

const HEALTH_COLORS: Record<UploadHealth, string> = {
  good: '#22c55e',   // green
  slow: '#eab308',   // yellow
  error: '#ef4444',  // red
};

const STATUS_LABELS: Partial<Record<LivestreamStatus, string>> = {
  connecting: 'Connecting...',
  live: 'LIVE',
  paused: 'Paused',
  ending: 'Ending...',
};

export const StreamHealthBadge = memo<StreamHealthBadgeProps>(({
  status,
  uploadHealth = 'good',
}) => {
  if (status === 'idle' || status === 'ended' || status === 'error') return null;

  const dotColor = status === 'connecting' ? HEALTH_COLORS.slow : HEALTH_COLORS[uploadHealth];
  const label = STATUS_LABELS[status] || status;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
});

StreamHealthBadge.displayName = 'StreamHealthBadge';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: '600',
  },
});

export default StreamHealthBadge;
