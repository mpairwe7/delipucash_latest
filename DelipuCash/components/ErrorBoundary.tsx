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
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

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
        <View style={styles.container} accessibilityRole="alert">
          <AlertTriangle size={48} color="#EF4444" strokeWidth={1.5} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {screenName ? `Error in ${screenName}. ` : ''}
            {errorCount > 2
              ? 'This issue persists. Try restarting the app.'
              : 'Please try again.'}
          </Text>
          {__DEV__ && error && (
            <Text style={styles.debug} numberOfLines={3}>
              {error.message}
            </Text>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <RefreshCw size={18} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  debug: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
