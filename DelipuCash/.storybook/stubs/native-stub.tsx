/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Web stub for native-only modules (RevenueCat, react-native-maps, webview, expo-video,
 * expo-camera) that the `@/components` barrel transitively imports. Storybook never renders
 * the payment/livestream components, so these only need to satisfy the import graph — every
 * named import used across the codebase is exported here as an inert value/component.
 */
import * as React from 'react';

const NullComponent = (_props: any) => null;
const noop = () => undefined;

// react-native-purchases (default `Purchases` + enums/types)
const Purchases = {
  configure: noop,
  setLogLevel: noop,
  getOfferings: async () => ({ current: null, all: {} }),
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  addCustomerInfoUpdateListener: noop,
  removeCustomerInfoUpdateListener: noop,
  purchasePackage: noop,
  restorePurchases: async () => ({ entitlements: { active: {} } }),
  logIn: async () => ({}),
  logOut: async () => ({}),
};
export default Purchases;

export const LOG_LEVEL = { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };
export const PURCHASES_ERROR_CODE = {} as any;
export const PurchasesPackage = undefined as any;
export const CustomerInfo = undefined as any;

// react-native-purchases-ui
export const PAYWALL_RESULT = { NOT_PRESENTED: 'NOT_PRESENTED', PURCHASED: 'PURCHASED', CANCELLED: 'CANCELLED' };
export const presentPaywall = noop;
export const presentPaywallIfNeeded = noop;

// react-native-maps / @teovilla/react-native-web-maps
export const Marker = NullComponent;
export const Callout = NullComponent;
export const Polyline = NullComponent;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

// react-native-webview
export const WebView = NullComponent;
export const WebViewNavigation = undefined as any;

// expo-video
export const VideoView = NullComponent;
export const useVideoPlayer = () => ({ play: noop, pause: noop, replace: noop, release: noop });

// expo-camera
export const Camera = NullComponent;
export const CameraView = NullComponent;
export const CameraType = { back: 'back', front: 'front' } as any;
export const useCameraPermissions = () => [{ granted: true, status: 'granted' }, noop] as const;
export const useMicrophonePermissions = () => [{ granted: true, status: 'granted' }, noop] as const;

// expo-router (ships CJS — stubbed so the presentational components' `router.back()` etc.
// resolve without dragging the routing runtime into the web bundle).
export const router = {
  back: noop,
  push: noop,
  replace: noop,
  navigate: noop,
  setParams: noop,
  dismiss: noop,
  dismissAll: noop,
  canGoBack: () => false,
};
export const useRouter = () => router;
export const useLocalSearchParams = () => ({});
export const useGlobalSearchParams = () => ({});
export const usePathname = () => '/';
export const useSegments = () => [] as string[];
export const useFocusEffect = noop;
export const Link = NullComponent;
export const Redirect = NullComponent;
export const Stack = Object.assign(NullComponent, { Screen: NullComponent });
export const Tabs = Object.assign(NullComponent, { Screen: NullComponent });

// expo-status-bar
export const StatusBar = NullComponent;
export const setStatusBarStyle = noop;
export const setStatusBarBackgroundColor = noop;
export const setStatusBarHidden = noop;

// expo-haptics
export const impactAsync = async () => undefined;
export const notificationAsync = async () => undefined;
export const selectionAsync = async () => undefined;
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' } as any;
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' } as any;
