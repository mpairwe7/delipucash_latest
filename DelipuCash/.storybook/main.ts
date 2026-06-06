import type { StorybookConfig } from '@storybook/react-native-web-vite';
import path from 'node:path';

/**
 * Storybook (react-native-web + Vite) for visual regression of the presentational question
 * components. RN → react-native-web aliasing is handled by the framework; here we add the
 * `@/` path alias and stub the native-only modules that the `@/components` barrel transitively
 * imports (RevenueCat, maps, video, camera, webview) so the web build doesn't choke on them.
 */
// Storybook loads this config as ESM (no __dirname); it runs from the project root.
const root = process.cwd();
const nativeOnlyStub = path.resolve(root, '.storybook/stubs/native-stub.tsx');

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {},
  },
  viteFinal: async (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = [
      ...(Array.isArray(cfg.resolve.alias) ? cfg.resolve.alias : []),
      // Native-only modules with no web build — stub them.
      { find: 'react-native-purchases-ui', replacement: nativeOnlyStub },
      { find: 'react-native-purchases', replacement: nativeOnlyStub },
      { find: 'react-native-maps', replacement: nativeOnlyStub },
      { find: '@teovilla/react-native-web-maps', replacement: nativeOnlyStub },
      { find: 'react-native-webview', replacement: nativeOnlyStub },
      { find: 'expo-video', replacement: nativeOnlyStub },
      { find: 'expo-video-thumbnails', replacement: nativeOnlyStub },
      { find: 'expo-camera', replacement: nativeOnlyStub },
      // expo-router ships CJS and leaks `exports` into the web bundle — stub it.
      { find: 'expo-router', replacement: nativeOnlyStub },
      { find: 'expo-status-bar', replacement: nativeOnlyStub },
      { find: 'expo-haptics', replacement: nativeOnlyStub },
      // The bare `@/services` barrel pulls ad/purchases/SSE hooks — stub it (SurveyCard
      // only needs formatCurrency). Must precede the general `@/` alias.
      { find: /^@\/services$/, replacement: path.resolve(root, '.storybook/stubs/services-stub.ts') },
      // `@/` path alias (regex so it doesn't swallow @storybook/* etc.).
      { find: /^@\/(.*)$/, replacement: `${root}/$1` },
    ];
    // Some transitive deps mix CJS `exports`/`require` with ESM — convert them so the
    // browser bundle doesn't throw "exports is not defined".
    cfg.build = cfg.build ?? {};
    cfg.build.commonjsOptions = {
      ...(cfg.build.commonjsOptions ?? {}),
      transformMixedEsModules: true,
    };
    cfg.optimizeDeps = cfg.optimizeDeps ?? {};
    cfg.optimizeDeps.include = [
      ...(cfg.optimizeDeps.include ?? []),
      'lodash',
      'color2k',
      'date-fns',
      'serialize-error',
    ];
    return cfg;
  },
};

export default config;
