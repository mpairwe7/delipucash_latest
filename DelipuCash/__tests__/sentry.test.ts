/**
 * Sentry helper smoke tests.
 *
 * Confirms the wrapper degrades gracefully when no DSN is set — captureException
 * must not throw, identifyUser must not throw, and addBreadcrumb is a no-op.
 */

// Mock @sentry/react-native before importing the helper so we don't pull in
// the native module under jest-expo.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  withScope: (fn: any) => fn({ setContext: jest.fn() }),
  reactNativeTracingIntegration: () => ({}),
  wrap: (Component: any) => Component,
}));

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: { projectId: 'test' } }, version: '1.0.0' } },
}));

import { addBreadcrumb, captureException, identifyUser, initSentry } from '../utils/sentry';

describe('sentry helper', () => {
  beforeAll(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it('initSentry is a no-op when DSN is absent', () => {
    expect(() => initSentry()).not.toThrow();
  });

  it('captureException tolerates being called without init', () => {
    expect(() => captureException(new Error('oops'))).not.toThrow();
  });

  it('identifyUser tolerates null user', () => {
    expect(() => identifyUser(null)).not.toThrow();
    expect(() => identifyUser({ id: 'user-1' })).not.toThrow();
  });

  it('addBreadcrumb tolerates being called without init', () => {
    expect(() => addBreadcrumb('test.event', { foo: 'bar' })).not.toThrow();
  });
});
