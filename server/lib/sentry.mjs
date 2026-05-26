// Server-side Sentry initialization.
// This module is imported for its side effect from index.js BEFORE any other
// application imports so Sentry can auto-instrument http/express/prisma.
//
// Required env: SENTRY_DSN (optional SENTRY_RELEASE, SENTRY_ENVIRONMENT).

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const DSN = process.env.SENTRY_DSN || '';

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0.05'),
    sendDefaultPii: false,
    integrations: [nodeProfilingIntegration()],
    beforeSend(event) {
      // Strip sensitive headers + body fields that should never reach Sentry.
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.Authorization;
        delete event.request.headers.cookie;
      }
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data;
        if ('password' in data) data.password = '[redacted]';
        if ('refreshToken' in data) data.refreshToken = '[redacted]';
        if ('code' in data) data.code = '[redacted]';
        if ('token' in data) data.token = '[redacted]';
        if ('phoneNumber' in data) data.phoneNumber = '[redacted]';
        if ('phone' in data) data.phone = '[redacted]';
      }
      return event;
    },
  });
  console.log('[Sentry] Initialized for', process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development');
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[Sentry] SENTRY_DSN not set in production — crash reporting disabled.');
}

export { Sentry };
