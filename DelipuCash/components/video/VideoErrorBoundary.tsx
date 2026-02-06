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
  return (
    <View
      style={[
        styles.container,
        itemHeight ? { height: itemHeight } : undefined,
      ]}
      accessibilityRole="alert"
      accessibilityLabel="Video failed to load"
    >
      <AlertTriangle size={48} color="#FF6B6B" />
      <Text style={styles.title}>Video unavailable</Text>
      <Text style={styles.message}>
        {error?.message || 'Something went wrong loading this video'}
      </Text>
      <Pressable
        onPress={onRetry}
        style={styles.retryButton}
        accessibilityRole="button"
        accessibilityLabel="Retry loading video"
      >
        <RotateCcw size={18} color="#FFFFFF" />
        <Text style={styles.retryText}>Try Again</Text>
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
    console.warn('[VideoErrorBoundary] Caught error:', error.message);
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
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default VideoErrorBoundary;
