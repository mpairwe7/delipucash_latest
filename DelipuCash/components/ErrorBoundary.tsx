/**
 * Error Boundary Component
 *
 * Catches rendering errors in child components and displays a fallback UI.
 * Inspired by production-grade patterns from Stack Overflow, Reddit, Quora.
 *
 * Features:
 * - Graceful error recovery with retry
 * - Error reporting hook
 * - Accessible error messages
 * - Customizable fallback UI
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, COMPONENT_SIZE } from '@/utils/theme';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Screen/component name for error context */
  screenName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));
    this.props.onError?.(error, errorInfo);

    // Announce to screen readers
    AccessibilityInfo.announceForAccessibility(
      `An error occurred${this.props.screenName ? ` in ${this.props.screenName}` : ''}. Please try again.`
    );

    if (__DEV__) {
      console.error('[ErrorBoundary]', this.props.screenName || 'Unknown', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback, screenName } = this.props;
      const { error, errorCount } = this.state;

      if (typeof fallback === 'function') {
        if (error) {
          return fallback(error, this.handleRetry);
        }
        // fallback is a render function but error is null — fall through to default UI
      } else if (fallback) {
        return fallback;
      }

      return (
        <DefaultErrorFallback
          screenName={screenName}
          errorCount={errorCount}
          error={error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Theme-aware fallback UI (functional component so it can use useTheme hook)
// ---------------------------------------------------------------------------
interface DefaultErrorFallbackProps {
  screenName?: string;
  errorCount: number;
  error: Error | null;
  onRetry: () => void;
}

function DefaultErrorFallback({ screenName, errorCount, error, onRetry }: DefaultErrorFallbackProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} accessibilityRole="alert">
      <AlertTriangle size={48} color={colors.error} strokeWidth={1.5} />
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>
        {screenName ? `Error in ${screenName}. ` : ''}
        {errorCount > 2
          ? 'This issue persists. Try restarting the app.'
          : 'Please try again.'}
      </Text>
      {__DEV__ && error && (
        <Text style={[styles.debug, { color: colors.textMuted }]} numberOfLines={3}>
          {error.message}
        </Text>
      )}
      <Pressable
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      >
        <RefreshCw size={18} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  debug: {
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
