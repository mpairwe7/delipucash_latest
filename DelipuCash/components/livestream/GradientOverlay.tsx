/**
 * GradientOverlay Component
 * Top and bottom gradient overlays for camera view
 * Design System Compliant
 */

import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Z_INDEX } from '@/utils/theme';
import { getResponsiveSize } from '@/utils/video-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface GradientOverlayProps {
  /** Position of the gradient */
  position: 'top' | 'bottom';
  /** Gradient intensity (0-1) */
  intensity?: number;
  /** Custom height */
  height?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const GradientOverlay = memo<GradientOverlayProps>(({
  position,
  intensity = 0.7,
  height,
}) => {
  const defaultHeight = getResponsiveSize(100, 140, 180);
  const finalHeight = height || defaultHeight;

  const colors = position === 'top'
    ? [`rgba(0,0,0,${intensity})`, 'transparent']
    : ['transparent', `rgba(0,0,0,${intensity})`];

  return (
    <LinearGradient
      colors={colors as [string, string, ...string[]]}
      style={[
        styles.gradient,
        position === 'top' ? styles.top : styles.bottom,
        { height: finalHeight },
      ]}
      pointerEvents="none"
    />
  );
});

GradientOverlay.displayName = 'GradientOverlay';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: Z_INDEX.base + 1,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});

export default GradientOverlay;
