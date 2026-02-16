/**
 * BottomControls Component
 * Bottom camera controls with record button and side actions
 * Design System Compliant - Inspired by TikTok/Instagram
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Music, Sparkles, ImageIcon, Filter } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, RADIUS, Z_INDEX, useTheme } from '@/utils/theme';
import { RecordButton } from './RecordButton';
import { getResponsiveSize, getResponsivePadding, formatDuration } from '@/utils/video-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface BottomControlsProps {
  /** Whether recording is in progress */
  isRecording: boolean;
  /** Whether uploading is in progress */
  isUploading: boolean;
  /** Record button press handler */
  onRecordPress: () => void;
  /** Music button press handler */
  onMusicPress?: () => void;
  /** Effects button press handler */
  onEffectsPress?: () => void;
  /** Gallery button press handler */
  onGalleryPress?: () => void;
  /** Filters button press handler */
  onFiltersPress?: () => void;
  /** Fade animation value */
  fadeAnim?: Animated.Value;
  /** Whether controls are visible */
  visible?: boolean;
  /** Upload progress (0-100) */
  uploadProgress?: number;
  /** Maximum recording duration in seconds (for dynamic hint) */
  maxDuration?: number;
  /** Whether user has premium access */
  hasVideoPremium?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SideButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

const SideButton = memo<SideButtonProps>(({ icon, label, onPress, disabled }) => {
  const buttonSize = getResponsiveSize(60, 70, 80);
  const labelSize = getResponsiveSize(10, 12, 14);

  return (
    <TouchableOpacity
      style={[styles.sideButton, { width: buttonSize }]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {icon}
      <Text style={[styles.sideButtonLabel, { fontSize: labelSize }]}>{label}</Text>
    </TouchableOpacity>
  );
});

SideButton.displayName = 'SideButton';

// ============================================================================
// COMPONENT
// ============================================================================

export const BottomControls = memo<BottomControlsProps>(({
  isRecording,
  isUploading,
  onRecordPress,
  onMusicPress,
  onEffectsPress,
  onGalleryPress,
  onFiltersPress,
  fadeAnim,
  visible = true,
  uploadProgress,
  maxDuration,
  hasVideoPremium,
}) => {
  useTheme(); // Theme context for potential future use
  const iconSize = getResponsiveSize(20, 24, 28);
  const padding = getResponsivePadding();

  if (!visible) return null;

  const content = (
    <View style={[styles.container, { paddingHorizontal: padding }]}>
      {isUploading ? (
        // Uploading state
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.uploadingText}>
            {uploadProgress !== undefined 
              ? `Uploading... ${uploadProgress}%` 
              : 'Uploading your video...'}
          </Text>
          <Text style={styles.uploadingSubtext}>
            Please wait, this may take a moment
          </Text>
        </View>
      ) : (
        // Normal controls
        <>
          <View style={styles.controlsRow}>
            {/* Left side buttons */}
            <View style={styles.sideButtons}>
              <SideButton
                icon={<Music size={iconSize} color="white" />}
                label="Music"
                onPress={onMusicPress}
                disabled={isRecording}
              />
            </View>

            {/* Center record button */}
            <RecordButton
              isRecording={isRecording}
              onPress={onRecordPress}
              size="large"
            />

            {/* Right side buttons */}
            <View style={styles.sideButtons}>
              <SideButton
                icon={<Sparkles size={iconSize} color="white" />}
                label="Effects"
                onPress={onEffectsPress}
                disabled={isRecording}
              />
            </View>
          </View>

          {/* Secondary row */}
          {!isRecording && (
            <View style={styles.secondaryRow}>
              <SideButton
                icon={<ImageIcon size={iconSize - 4} color="white" />}
                label="Gallery"
                onPress={onGalleryPress}
              />
              <SideButton
                icon={<Filter size={iconSize - 4} color="white" />}
                label="Filters"
                onPress={onFiltersPress}
              />
            </View>
          )}

          {/* Recording hint */}
          {!isRecording && (
            <Text style={styles.hint}>
              Tap to start recording (max {formatDuration(maxDuration || 300)})
              {!hasVideoPremium ? ' \u00B7 Upgrade for more' : ''}
            </Text>
          )}
        </>
      )}
    </View>
  );

  if (fadeAnim) {
    return (
      <Animated.View
        style={[
          styles.animatedContainer,
          { opacity: fadeAnim },
        ]}
      >
        {content}
      </Animated.View>
    );
  }

  return <View style={styles.staticContainer}>{content}</View>;
});

BottomControls.displayName = 'BottomControls';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  animatedContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 0,
    right: 0,
    zIndex: Z_INDEX.fixed,
  },
  staticContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 0,
    right: 0,
    zIndex: Z_INDEX.fixed,
  },
  container: {
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 350,
  },
  sideButtons: {
    flex: 1,
    alignItems: 'center',
  },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  sideButtonLabel: {
    color: 'white',
    fontWeight: '500',
    marginTop: SPACING.xs,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    gap: SPACING['3xl'],
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.md,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  uploadingContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: SPACING['2xl'],
    paddingHorizontal: SPACING['3xl'],
    borderRadius: RADIUS.xl,
  },
  uploadingText: {
    color: 'white',
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: 'bold',
    marginTop: SPACING.md,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  uploadingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
});

export default BottomControls;
