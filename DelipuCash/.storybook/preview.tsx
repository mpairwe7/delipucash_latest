import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Preview } from '@storybook/react-native-web-vite';

// Fixed safe-area metrics so useSafeAreaInsets() resolves (QuestionDetailHeader uses it)
// and the rendered output is deterministic.
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 420, height: 900 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

// Components may call TanStack Query hooks (e.g. SurveyCard → useRewardConfig); without a
// provider they throw and the story never renders. Static Storybook has no API, so queries
// fail fast (retry: false) and components render their no-data fallback — deterministically
// (no refetch churn between the screenshot and the baseline).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    },
  },
});

/**
 * Consistent dark, fixed-width frame around every story so screenshots are stable.
 * The app's theme defaults to dark (#000000).
 */
const preview: Preview = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <View style={{ padding: 16, backgroundColor: '#000000', width: 420 }}>
            <Story />
          </View>
        </SafeAreaProvider>
      </QueryClientProvider>
    ),
  ],
};

export default preview;
