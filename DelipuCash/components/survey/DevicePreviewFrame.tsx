/**
 * DevicePreviewFrame — Device frame mockup for survey previews
 *
 * Renders survey questions inside a phone-shaped frame so creators
 * can see how their survey will look on mobile devices.
 *
 * Features:
 * - iPhone-style frame with notch/dynamic island
 * - Scrollable content with actual question renderers (read-only)
 * - Scale transform to fit preview area
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SPACING, RADIUS, TYPOGRAPHY, useTheme, withAlpha } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

interface DevicePreviewFrameProps {
  title: string;
  description?: string;
  /** Rendered question content */
  children: React.ReactNode;
  /** Scale factor (0-1). Default 0.75 */
  scale?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DevicePreviewFrame: React.FC<DevicePreviewFrameProps> = ({
  title,
  description,
  children,
  scale = 0.75,
}) => {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // Phone frame dimensions (iPhone 15 proportions)
  const frameWidth = Math.min(windowWidth - SPACING.xl * 2, 375);
  const frameHeight = frameWidth * 2.1;

  return (
    <View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <View
        style={[
          styles.frame,
          {
            width: frameWidth,
            height: frameHeight,
            backgroundColor: colors.background,
            borderColor: withAlpha(colors.text, 0.15),
          },
        ]}
      >
        {/* Dynamic Island */}
        <View style={[styles.dynamicIsland, { backgroundColor: withAlpha(colors.text, 0.9) }]} />

        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={[styles.statusTime, { color: colors.text }]}>9:41</Text>
        </View>

        {/* Survey content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled
        >
          <Text style={[styles.surveyTitle, { color: colors.text }]}>{title || 'Untitled Survey'}</Text>
          {description ? (
            <Text style={[styles.surveyDescription, { color: colors.textMuted }]}>{description}</Text>
          ) : null}

          {children}
        </ScrollView>

        {/* Home indicator */}
        <View style={styles.homeIndicatorArea}>
          <View style={[styles.homeIndicator, { backgroundColor: withAlpha(colors.text, 0.3) }]} />
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    borderRadius: 44,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  dynamicIsland: {
    position: 'absolute',
    top: 10,
    left: '50%',
    marginLeft: -55,
    width: 110,
    height: 30,
    borderRadius: 20,
    zIndex: 10,
  },
  statusBar: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  statusTime: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  surveyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
  },
  surveyDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  homeIndicatorArea: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
  },
});

export default DevicePreviewFrame;
