import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Preview } from '@storybook/react-native-web-vite';

// Fixed safe-area metrics so useSafeAreaInsets() resolves (QuestionDetailHeader uses it)
// and the rendered output is deterministic.
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 420, height: 900 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

/**
 * Consistent dark, fixed-width frame around every story so screenshots are stable.
 * The app's theme defaults to dark (#000000).
 */
const preview: Preview = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <View style={{ padding: 16, backgroundColor: '#000000', width: 420 }}>
          <Story />
        </View>
      </SafeAreaProvider>
    ),
  ],
};

export default preview;
