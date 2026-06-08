/**
 * Test harness entry point. Re-exports RNTL (render, screen, fireEvent, waitFor,
 * within, act, …) plus the provider-aware render helper, so tests import from one place:
 *
 *   import { renderWithProviders, screen, fireEvent } from '@/test-utils';
 */
export * from '@testing-library/react-native';
export { renderWithProviders, createProvidersWrapper } from './renderWithProviders';
export type { RenderWithProvidersOptions } from './renderWithProviders';
export { renderWithProfiler } from './renderWithProfiler';
export type { ProfilerCounter } from './renderWithProfiler';
export { createTestQueryClient } from './createTestQueryClient';
