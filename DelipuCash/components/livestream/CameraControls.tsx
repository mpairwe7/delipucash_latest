/**
 * CameraControls Component
 * Top camera controls bar with flip, flash, zoom
 * Design System Compliant - Inspired by TikTok/Instagram
 */

import React, { memo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import {
  RefreshCw,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
  X,
  Settings,
} from 'lucide-react-native';
import { SPACING, Z_INDEX } from '@/utils/theme';
import { CameraControlButton } from './CameraControlButton';
import { getResponsiveSize, getResponsivePadding } from '@/utils/video-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface CameraControlsProps {
  /** Whether camera is facing front */
  isFrontCamera: boolean;
  /** Toggle camera facing */
  onToggleCamera: () => void;
  /** Whether torch/flash is on */
  isTorchOn: boolean;
  /** Toggle torch */
  onToggleTorch: () => void;
  /** Current zoom level (0-1) */
  zoomLevel: number;
  /** Zoom in handler */
  onZoomIn: () => void;
  /** Zoom out handler */
  onZoomOut: () => void;
  /** Close/exit handler */
  onClose: () => void;
  /** Settings handler */
  onSettings?: () => void;
  /** Fade animation value */
  fadeAnim?: Animated.Value;
  /** Whether controls are visible */
  visible?: boolean;
  /** Whether recording is in progress */
  isRecording?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CameraControls = memo<CameraControlsProps>(({
  isFrontCamera,
  onToggleCamera,
  isTorchOn,
  onToggleTorch,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onClose,
  onSettings,
  fadeAnim,
  visible = true,
  isRecording = false,
}) => {
  if (!visible) return null;

  const responsiveSize = getResponsiveSize(36, 44, 52);
  const buttonSize: 'small' | 'medium' | 'large' = responsiveSize <= 36 ? 'small' : responsiveSize <= 44 ? 'medium' : 'large';
  const iconSize = getResponsiveSize(20, 24, 28);
  const padding = getResponsivePadding();

  const content = (
    <View style={[styles.container, { paddingHorizontal: padding }]}>
      {/* Left Controls */}
      <View style={styles.leftControls}>
        <CameraControlButton
          icon={<X size={iconSize} color="white" />}
          onPress={onClose}
          size={buttonSize}
          accessibilityLabel="Close camera"
        />
      </View>

      {/* Right Controls */}
      <View style={styles.rightControls}>
        <CameraControlButton
          icon={<RefreshCw size={iconSize} color="white" />}
          onPress={onToggleCamera}
          size={buttonSize}
          accessibilityLabel={isFrontCamera ? 'Switch to back camera' : 'Switch to front camera'}
          disabled={isRecording}
        />

        {/* Only show torch for back camera */}
        {!isFrontCamera && (
          <CameraControlButton
            icon={
              isTorchOn 
                ? <Zap size={iconSize} color="#FFD700" />
                : <ZapOff size={iconSize} color="white" />
            }
            onPress={onToggleTorch}
            size={buttonSize}
            accessibilityLabel={isTorchOn ? 'Turn off flash' : 'Turn on flash'}
            style={styles.controlButton}
          />
        )}

        <CameraControlButton
          icon={<ZoomIn size={iconSize} color={zoomLevel >= 0.8 ? 'rgba(255,255,255,0.5)' : 'white'} />}
          onPress={onZoomIn}
          size={buttonSize}
          accessibilityLabel="Zoom in"
          disabled={zoomLevel >= 0.8}
          style={styles.controlButton}
        />

        <CameraControlButton
          icon={<ZoomOut size={iconSize} color={zoomLevel <= 0 ? 'rgba(255,255,255,0.5)' : 'white'} />}
          onPress={onZoomOut}
          size={buttonSize}
          accessibilityLabel="Zoom out"
          disabled={zoomLevel <= 0}
          style={styles.controlButton}
        />

        {onSettings && (
          <CameraControlButton
            icon={<Settings size={iconSize} color="white" />}
            onPress={onSettings}
            size={buttonSize}
            accessibilityLabel="Camera settings"
            style={styles.controlButton}
          />
        )}
      </View>
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

  return content;
});

CameraControls.displayName = 'CameraControls';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  animatedContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    zIndex: Z_INDEX.fixed,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    marginLeft: SPACING.sm,
  },
});

export default CameraControls;
