import prisma from '../lib/prisma.mjs';
import { cleanupOldEvents } from '../lib/eventBus.mjs';

// Connection configuration (overridable via env vars)
const CONNECTION_TTL_MS = parseInt(process.env.SSE_CONNECTION_TTL_MS || '25000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.SSE_HEARTBEAT_MS || '10000', 10);
const POLL_INTERVAL_MS = parseInt(process.env.SSE_POLL_MS || '3000', 10);
const MAX_EVENTS_PER_FLUSH = 50;

/**
 * GET /api/sse/stream
 *
 * Server-Sent Events endpoint. Requires JWT authentication.
 * Streams events for the authenticated user with:
 * - Last-Event-ID resumption support
 * - Heartbeat keep-alive every 10s
 * - Automatic close after 25s TTL (Vercel-compatible)
 * - Event log polling every 3s
 */
export const sseStream = async (req, res) => {
  const userId = req.user?.id || req.userRef;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Parse Last-Event-ID for resumption after reconnect
  const lastEventIdHeader = req.headers['last-event-id'];
  let lastSeq = 0;
  if (lastEventIdHeader) {
    const parsed = parseInt(lastEventIdHeader, 10);
    if (!isNaN(parsed)) {
      lastSeq = parsed;
    }
  }

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.(); // important on some proxies (Vercel, nginx)

  // Send retry instruction and initial connected comment
  res.write('retry: 3000\n\n');
  res.write(': connected\n\n');

  // Flush any missed events since last connection
  lastSeq = await flushEvents(res, userId, lastSeq);

  const connectionStart = Date.now();
  let isConnected = true;

  // Heartbeat timer — keep connection alive
  const heartbeatTimer = setInterval(() => {
    if (!isConnected) return;
    try {
      res.write(`:heartbeat ${Date.now()}\n\n`);
    } catch {
      isConnected = false;
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Poll timer — check for new events
  const pollTimer = setInterval(async () => {
    if (!isConnected) return;

    // TTL check — gracefully close when time is up
    if (Date.now() - connectionStart >= CONNECTION_TTL_MS) {
      try {
        res.write('event: reconnect\ndata: {"reason":"ttl"}\n\n');
      } catch {
        // ignore write errors during shutdown
      }
      cleanup();
      return;
    }

    try {
      lastSeq = await flushEvents(res, userId, lastSeq);
    } catch (error) {
      console.error('[SSE] Poll error:', error.message);
    }
  }, POLL_INTERVAL_MS);

  // Cleanup function — clear timers and close response
  const cleanup = () => {
    if (!isConnected) return;
    isConnected = false;
    clearInterval(heartbeatTimer);
    clearInterval(pollTimer);
    try {
      res.end();
    } catch {
      // ignore
    }
    // Opportunistic cleanup of old events (non-blocking)
    cleanupOldEvents(10).catch(() => {});
  };

  // Handle client disconnect or errors
  req.on('close', cleanup);
  req.on('error', cleanup);
};

/**
 * GET /api/sse/poll?lastSeq=0
 *
 * Lightweight JSON endpoint for edge function polling.
 * Returns pending events as JSON array (no streaming required).
 * Protected by verifyToken middleware (same as /stream).
 */
export const ssePoll = async (req, res) => {
  const userId = req.user?.id || req.userRef;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  let lastSeq = parseInt(req.query.lastSeq, 10) || 0;

  const events = await prisma.sSEEvent.findMany({
    where: {
      userId,
      seq: { gt: lastSeq },
    },
    orderBy: { seq: 'asc' },
    take: MAX_EVENTS_PER_FLUSH,
    select: { seq: true, type: true, payload: true },
  });

  return res.json({ events });
};

/**
 * Flush all events for a user with seq > lastSeq.
 * Returns the updated lastSeq after flushing.
 */
async function flushEvents(res, userId, lastSeq) {
  const events = await prisma.sSEEvent.findMany({
    where: {
      userId,
      seq: { gt: lastSeq },
    },
    orderBy: { seq: 'asc' },
    take: MAX_EVENTS_PER_FLUSH,
  });

  for (const event of events) {
    const sseMessage =
      `id: ${event.seq}\n` +
      `event: ${event.type}\n` +
      `data: ${JSON.stringify(event.payload)}\n\n`;
    res.write(sseMessage);
    lastSeq = event.seq;
  }

  return lastSeq;
}
