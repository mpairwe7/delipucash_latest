# Real-Time Events (SSE)

> **Status (2026-05): DISABLED BY DEFAULT.** The mobile client moved to Expo Push +
> TanStack Query polling (`SSEStore.isEnabled = false`), so SSE and the PostgreSQL
> `LISTEN/NOTIFY` connection are gated behind `REALTIME_SSE_ENABLED` (default `false`).
> On Vercel serverless they stay **off** — enabling them opened a dedicated direct DB
> connection per instance and forced 25s reconnect storms. The architecture below applies
> only when the flag is enabled on a dedicated long-running instance. See
> [Serverless Hardening](serverless-hardening.md).

## Overview

DelipuCash uses Server-Sent Events (SSE) for real-time server-to-client communication. Events are stored in the `SSEEvent` database table and streamed to connected clients.

## Architecture

```mermaid
graph LR
    subgraph Publishers
        CTRL["Controllers<br/>(any mutation)"]
    end

    subgraph Storage
        DB["SSEEvent Table<br/>(10-min TTL)"]
    end

    subgraph Delivery
        SSE["SSE Endpoint<br/>(/api/sse/stream)"]
        POLL["Poll Endpoint<br/>(/api/sse/poll)"]
    end

    subgraph Clients
        APP["Mobile App"]
    end

    CTRL -->|"publishEvent()"| DB
    SSE -->|"Poll every 3s"| DB
    POLL -->|"On-demand"| DB
    SSE -->|"event stream"| APP
    POLL -->|"JSON response"| APP
```

## Event Publishing

**File:** `server/lib/eventBus.mjs`

```javascript
// Publish to a single user (fire-and-forget)
await publishEvent(userId, 'notification.new', { id, title, body });

// Publish to multiple users
await publishEventToMany(userIds, 'reward.earned', { points, description });

// Cleanup old events (called periodically)
await cleanupOldEvents(10); // Delete events older than 10 minutes
```

Publishing never throws — errors are logged but don't crash the triggering mutation.

## SSE Stream Endpoint

**`GET /api/sse/stream`** (requires JWT)

### Connection Lifecycle

1. Client connects with `Authorization: Bearer <token>`
2. Server sets SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`)
3. Server polls `SSEEvent` table every 3 seconds for new events
4. Events are sent in standard SSE format
5. Heartbeat comment (`: heartbeat`) sent every 10 seconds
6. Connection auto-closes after 25 seconds (Vercel serverless limit)
7. Client reconnects with `Last-Event-ID` header for resumption

### SSE Message Format

```text
id: 42
event: notification.new
data: {"id":"uuid","title":"Reward Earned","body":"You earned 500 points!"}

id: 43
event: payment.success
data: {"amount":5000,"provider":"MTN","reference":"TXN-123"}
```

### Resumption

The `seq` field (auto-increment) enables gap-free resumption:

```text
Client connects → Last-Event-ID: 42
Server queries → WHERE userId = ? AND seq > 42
Server sends → Events 43, 44, 45...
```

## JSON Poll Endpoint

**`GET /api/sse/poll`** (requires JWT)

Alternative for environments where SSE streams are impractical (e.g., edge function bridging):

```json
{
  "lastSeq": 45,
  "events": [
    { "type": "notification.new", "payload": { "id": "...", "title": "..." } },
    { "type": "reward.earned", "payload": { "points": 500 } }
  ]
}
```

## Event Types

| Event Type | Published By | Payload |
|-----------|-------------|---------|
| `notification.new` | notificationController | `{ id, title, body, type, priority }` |
| `payment.success` | paymentController | `{ amount, provider, reference }` |
| `payment.failed` | paymentController | `{ error, refunded }` |
| `reward.earned` | rewardQuestionController | `{ points, description }` |

## Client Integration

On the frontend, SSE is managed by `SSEManager` in `services/sse/`:

```typescript
// Hook usage
const { isConnected } = useSSE();

// Listen for specific events
eventSource.addEventListener('notification.new', (event) => {
  const data = JSON.parse(event.data);
  // Update notification count, show toast, etc.
});
```

The `SSEProvider` component in the app layout manages connection lifecycle, reconnection, and the Zustand `SSEStore` for connection status.

## Configuration

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `REALTIME_SSE_ENABLED` | `false` (default) | Master switch — when false, SSE/LISTEN are off and the parameters below do not apply |
| Poll interval | 3 seconds | How often stream checks for new events |
| Heartbeat | 10 seconds (`SSE_HEARTBEAT_MS`) | Keep-alive for proxies |
| Connection TTL | 25 seconds (`SSE_CONNECTION_TTL_MS`) | Vercel serverless limit |
| Event TTL | 10 minutes | Auto-cleanup of old events |

When `REALTIME_SSE_ENABLED` is unset/false (the serverless default), `publishEvent` is a
no-op, the `/api/sse` and `/api/realtime` routes are not mounted, and no `LISTEN`
connection is opened. Enable it only on a dedicated long-running (non-serverless) instance.
