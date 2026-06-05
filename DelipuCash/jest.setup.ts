/**
 * Global Jest setup — native-module mocks for the question-screen regression suite.
 *
 * Applied to every test file via `setupFilesAfterEnv` in package.json. Mirrors the
 * per-file `jest.mock(path, factory)` idiom already used in
 * __tests__/instantRewardStore.test.ts and __tests__/sentry.test.ts
 * (`__esModule: true` + `default` for default-export native modules).
 *
 * RNTL v13 auto-registers its Jest matchers (build/index.js requires
 * ./matchers/extend-expect), so no matcher import is needed here.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

// Reanimated — official jest mock covers FadeIn.duration(), useSharedValue,
// useAnimatedStyle, useAnimatedScrollHandler, withTiming/withSpring, interpolate.
// NOTE: reanimated 4's mock imports runtime values from the real index, which needs
// react-native-worklets' createSerializable at load time — so worklets is intentionally
// NOT mocked here (the real JS implementation provides it without native bindings).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// AsyncStorage — same shape the existing store tests rely on (theme + UI stores persist).
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

// Sentry — no-op wrapper (same approach as __tests__/sentry.test.ts).
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component: unknown) => component,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  setExtra: jest.fn(),
  withScope: jest.fn((cb: (scope: unknown) => void) =>
    cb({ setTag: jest.fn(), setContext: jest.fn(), setLevel: jest.fn(), setExtra: jest.fn() })
  ),
  reactNavigationIntegration: jest.fn(() => ({})),
  mobileReplayIntegration: jest.fn(() => ({})),
  TouchEventBoundary: ({ children }: { children: unknown }) => children,
}));

// expo-constants — Sentry init reads projectId + app version.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'test' } }, version: '1.0.0' },
    easConfig: { projectId: 'test' },
  },
}));

// expo-haptics — triggerHaptic() (utils/quiz-utils) calls into these.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// expo-status-bar — render nothing; keep imperative API as no-ops.
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
  setStatusBarStyle: jest.fn(),
  setStatusBarBackgroundColor: jest.fn(),
  setStatusBarHidden: jest.fn(),
}));

// React Navigation focus/scroll hooks need a NavigationContainer at runtime (e.g.
// hooks/useStatusBar uses useFocusEffect). No-op the focus-side-effect hooks so screens
// render outside a container; keep the rest of the module (NavigationContainer, etc.) real.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: jest.fn(),
    useIsFocused: () => true,
    useScrollToTop: jest.fn(),
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
      dispatch: jest.fn(),
      canGoBack: () => false,
    }),
  };
});

// Notification context — NotificationBell (rendered in the feed header) calls
// usePushNotifications, which otherwise requires a NotificationProvider. Stub the hook so
// screens render without wrapping every test in the provider.
jest.mock('@/utils/usePushNotifications', () => ({
  __esModule: true,
  usePushNotifications: () => ({
    hasNewNotification: false,
    markNotificationsSeen: jest.fn(),
    unreadCount: 0,
    notifications: [],
    expoPushToken: undefined,
    refresh: jest.fn(),
  }),
  NotificationProvider: ({ children }: { children: unknown }) => children,
}));

// Heavy native modules reachable only through the `@/components` barrel (payment +
// livestream components) — stubbed so importing a question component doesn't drag in
// RevenueCat/native-maps. The question screens never call these at runtime.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(() => Promise.resolve({ current: null, all: {} })),
    getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    logIn: jest.fn(() => Promise.resolve({})),
    logOut: jest.fn(() => Promise.resolve({})),
  },
  LOG_LEVEL: { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
}));
jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentPaywall: jest.fn(), presentPaywallIfNeeded: jest.fn() },
  PAYWALL_RESULT: { NOT_PRESENTED: 'NOT_PRESENTED', PURCHASED: 'PURCHASED', CANCELLED: 'CANCELLED' },
}));
jest.mock('react-native-maps', () => {
  const React = require('react');
  const Stub = (props: { children?: unknown }) => React.createElement('MapView', props, props.children);
  return {
    __esModule: true,
    default: Stub,
    Marker: (props: object) => React.createElement('Marker', props),
    Callout: (props: object) => React.createElement('Callout', props),
    Polyline: (props: object) => React.createElement('Polyline', props),
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: 'default',
  };
});

// expo-video / camera / webview / blur / image — native-backed media modules reachable
// through the components barrel. Stubbed to inert host nodes (question screens never use them).
jest.mock('expo-video', () => {
  const React = require('react');
  return {
    __esModule: true,
    VideoView: (props: { children?: unknown }) => React.createElement('VideoView', props, props.children),
    useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), release: jest.fn() }),
  };
});
jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    __esModule: true,
    CameraView: (props: { children?: unknown }) => React.createElement('CameraView', props, props.children),
    Camera: (props: { children?: unknown }) => React.createElement('Camera', props, props.children),
    useCameraPermissions: () => [{ granted: true, status: 'granted' }, jest.fn()],
  };
});
jest.mock('react-native-webview', () => {
  const React = require('react');
  const WebView = (props: object) => React.createElement('WebView', props);
  return { __esModule: true, default: WebView, WebView };
});
jest.mock('expo-blur', () => {
  const React = require('react');
  return {
    __esModule: true,
    BlurView: (props: { children?: unknown }) => React.createElement('BlurView', props, props.children),
  };
});
jest.mock('expo-image', () => {
  const React = require('react');
  return {
    __esModule: true,
    Image: (props: object) => React.createElement('ExpoImage', props),
  };
});

// lucide-react-native — every icon becomes a lightweight host stub so SVG cost and
// non-deterministic paths stay out of render/snapshot output.
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        if (typeof prop === 'symbol') return undefined;
        const Icon = (props: Record<string, unknown>) => React.createElement('Icon', props);
        Icon.displayName = String(prop);
        return Icon;
      },
    }
  );
});
