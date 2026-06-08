import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  if (!DSN) {
    if (__DEV__) {
      console.info('[Sentry] No EXPO_PUBLIC_SENTRY_DSN set — crash reporting disabled.');
    }
    return;
  }

  const releaseChannel = (Constants.expoConfig?.extra as { eas?: { projectId?: string } })?.eas
    ?.projectId
    ? `${Constants.expoConfig?.version ?? 'unknown'}+${Constants.expoConfig?.runtimeVersion ?? 'unknown'}`
    : 'dev';

  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    environment: process.env.NODE_ENV ?? (__DEV__ ? 'development' : 'production'),
    release: releaseChannel,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.05,
    attachStacktrace: true,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.Authorization;
        delete event.request.headers.cookie;
      }
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
      }
      return event;
    },
    // Native frames tracking is a top-level init option (not a tracing-integration option).
    enableNativeFramesTracking: Platform.OS !== 'web',
    integrations: [Sentry.reactNativeTracingIntegration()],
  });

  initialized = true;
}

export function identifyUser(user: { id: string } | null) {
  if (!initialized) return;
  if (user?.id) {
    Sentry.setUser({ id: user.id });
  } else {
    Sentry.setUser(null);
  }
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.addBreadcrumb({
    message,
    category: 'app',
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    if (__DEV__) console.warn('[Sentry] Not initialized — captureException ignored', error);
    return;
  }
  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setContext(key, value as Record<string, unknown>);
      }
    }
    Sentry.captureException(error);
  });
}

export { Sentry };
