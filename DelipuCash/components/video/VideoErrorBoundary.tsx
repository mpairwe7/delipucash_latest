/**
 * VideoErrorBoundary Component
 * Catches rendering errors in video components and displays a fallback UI
 * 
 * Industry Standard: Error boundaries prevent a single video failure from
 * crashing the entire feed. TikTok/Instagram/YouTube all use similar patterns
 * to isolate video player errors.
 * 
 * @example
 * ```tsx
 * <VideoErrorBoundary fallback={<VideoErrorFallback />}>
 *   <VideoFeedItem ... />
 * </VideoErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { RotateCcw, AlertTriangle } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  COMPONENT_SIZE,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

interface VideoErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Item height for consistent layout */
  itemHeight?: number;
}

interface VideoErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// ERROR FALLBACK COMPONENT
// ============================================================================

function DefaultErrorFallback({
  error,
  onRetry,
  itemHeight,
}: {
  error: Error | null;
  onRetry: () => void;
  itemHeight?: number;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
        itemHeight ? { height: itemHeight } : undefined,
      ]}
      accessibilityRole="alert"
      accessibilityLabel="Video failed to load"
    >
      <AlertTriangle size={48} color={colors.error} />
      <Text style={[styles.title, { color: colors.text }]}>Video unavailable</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>
        {error?.message || 'Something went wrong loading this video'}
      </Text>
      <Pressable
        onPress={onRetry}
        style={[styles.retryButton, { backgroundColor: withAlpha(colors.text, 0.15) }]}
        accessibilityRole="button"
        accessibilityLabel="Retry loading video"
        android_ripple={{ color: withAlpha(colors.text, 0.2) }}
      >
        <RotateCcw size={18} color={colors.text} />
        <Text style={[styles.retryText, { color: colors.text }]}>Try Again</Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// ERROR BOUNDARY CLASS COMPONENT
// ============================================================================

export class VideoErrorBoundary extends Component<
  VideoErrorBoundaryProps,
  VideoErrorBoundaryState
> {
  constructor(props: VideoErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): VideoErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (__DEV__) console.warn('[VideoErrorBoundary] Caught error:', error.message);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          itemHeight={this.props.itemHeight}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  retryText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '500',
  },
});

export default VideoErrorBoundary;
