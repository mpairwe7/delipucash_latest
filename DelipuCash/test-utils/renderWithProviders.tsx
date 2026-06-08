import React from 'react';
import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import type { RenderOptions } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createTestQueryClient } from './createTestQueryClient';

/**
 * Fixed safe-area metrics (iPhone-ish) so `useSafeAreaInsets()` returns stable,
 * non-zero values without a real device — keeps padding-derived layout deterministic.
 */
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export interface RenderWithProvidersOptions extends RenderOptions {
  /** Override the QueryClient (e.g. to pre-seed cache); defaults to a fresh test client. */
  queryClient?: QueryClient;
}

/**
 * Build the provider wrapper the question screens require: SafeAreaProvider (fixed insets)
 * + QueryClientProvider. Exposed separately so Reassure perf tests can pass it as the
 * `wrapper` option to measureRenders (same tree as renderWithProviders).
 *
 * No theme provider is needed — `useTheme` (utils/theme.ts) is Zustand-backed and reads
 * `useThemeStore` directly. Drive light/dark via `useThemeStore.setState({ isDark })`.
 */
export function createProvidersWrapper(queryClient: QueryClient = createTestQueryClient()) {
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SafeAreaProvider>
    );
  };
}

/**
 * Render a component tree wrapped in the standard question-screen providers.
 */
export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;
  const Wrapper = createProvidersWrapper(queryClient);
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
