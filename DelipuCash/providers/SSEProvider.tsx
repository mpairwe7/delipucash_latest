import { useSSEConnection } from '@/services/sse/useSSE';

/**
 * SSE Provider — mounts the SSE connection hook at the app root level.
 * Place inside QueryClientProvider so useQueryClient() is available.
 *
 * When SSE is unavailable (serverless deployment, 404, network issues):
 * - SSEManager marks status as 'unavailable'
 * - Notification hooks detect this via `selectNeedsPolling` and auto-switch
 *   to adaptive interval polling (30 s unread count, 60 s full list)
 * - When SSE reconnects, polling stops automatically
 */
export function SSEProvider({ children }: { children: React.ReactNode }) {
  useSSEConnection();
  return <>{children}</>;
}
