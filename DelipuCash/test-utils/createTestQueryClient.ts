import { QueryClient } from '@tanstack/react-query';

/**
 * A QueryClient tuned for tests: no retries (fail fast), no garbage collection or
 * staleness churn, so mocked query/mutation state stays deterministic across renders.
 *
 * Note: TanStack Query v5 removed the `logger` option, so query errors are silenced
 * via `retry: false` rather than a custom logger.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}
