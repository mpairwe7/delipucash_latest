import { useSSEConnection } from '@/services/sse/useSSE';

/**
 * SSE Provider — mounts the SSE connection hook at the app root level.
 * Place inside QueryClientProvider so useQueryClient() is available.
 */
export function SSEProvider({ children }: { children: React.ReactNode }) {
  useSSEConnection();
  return <>{children}</>;
}
