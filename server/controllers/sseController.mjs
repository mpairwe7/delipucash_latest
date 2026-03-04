import prisma from '../lib/prisma.mjs';
import { cleanupOldEvents } from '../lib/eventBus.mjs';
import { subscribe, isListenerActive, getSubscriberCount } from '../lib/pgNotify.mjs';

// ---------- Configuration (overridable via env) ----------

/** Max connection lifetime — Vercel/serverless safe. Set higher for long-lived servers. */
const CONNECTION_TTL_MS = parseInt(process.env.SSE_CONNECTION_TTL_MS || '25000', 10);
/** Heartbeat keep-alive interval. */
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.SSE_HEARTBEAT_MS || '15000', 10);
/** Safety-net poll interval. Only used when LISTEN is active to catch any missed events. */
const SAFETY_POLL_MS = parseInt(process.env.SSE_SAFETY_POLL_MS || '30000', 10);
/** Legacy poll interval. Used when LISTEN/NOTIFY is unavailable (no DIRECT_DATABASE_URL). */
const LEGACY_POLL_MS = parseInt(process.env.SSE_POLL_MS || '3000', 10);
/** Max events flushed per cycle. */
const MAX_EVENTS_PER_FLUSH = 50;
/** Max concurrent SSE connections per user. Prevents resource exhaustion. */
const MAX_CONNECTIONS_PER_USER = 5;
/** Max topic filter items per request. Prevents oversized IN clauses. */
const MAX_TOPIC_FILTERS = 20;

// ---------- Per-user connection tracking ----------

/** @type {Map<string, number>} userId → active connection count */
const connectionCounts = new Map();

function incrementConnections(userId) {
  const count = (connectionCounts.get(userId) || 0) + 1;
  connectionCounts.set(userId, count);
  return count;
}

function decrementConnections(userId) {
  const count = (connectionCounts.get(userId) || 1) - 1;
  if (count <= 0) {
    connectionCounts.delete(userId);
  } else {
    connectionCounts.set(userId, count);
  }
}

// ---------- SSE Stream Endpoint ----------

/**
 * GET /api/sse/stream   (legacy)
 * GET /api/realtime/sse  (new canonical)
 *
 * Server-Sent Events endpoint with real-time push via PostgreSQL LISTEN/NOTIFY.
 *
 * Features:
 *   - Instant delivery via pg LISTEN (sub-10ms latency)
 *   - Last-Event-ID resumption on reconnect
 *   - Topic filtering via ?topics= query param (max 20 topics)
 *   - Heartbeat keep-alive every 15s
 *   - Auto-close after TTL (serverless-compatible)
 *   - Safety-net poll every 30s (catches edge cases)
 *   - Graceful fallback to 3s polling when LISTEN is unavailable
 *   - Per-user connection cap (max 5 concurrent)
 *   - Backpressure detection (closes slow clients)
 */
export const sseStream = async (req, res) => {
  const userId = req.user?.id || req.userRef;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // ---------- Per-user connection limit ----------
  const currentCount = connectionCounts.get(userId) || 0;
  if (currentCount >= MAX_CONNECTIONS_PER_USER) {
    return res.status(429).json({
      success: false,
      message: `Too many SSE connections (max ${MAX_CONNECTIONS_PER_USER})`,
    });
  }
  incrementConnections(userId);

  // Parse optional topic filter: ?topics=notification.new,payment.status
  const topicsParam = req.query.topics;
  let topicFilter = null;
  if (topicsParam) {
    const topics = topicsParam.split(',').map((t) => t.trim()).filter(Boolean).slice(0, MAX_TOPIC_FILTERS);
    // Sanitize: allow only alphanumeric, dots, underscores (prevent injection into Prisma IN clause)
    const validTopics = topics.filter((t) => /^[\w.]+$/.test(t) && t.length <= 50);
    if (validTopics.length > 0) {
      topicFilter = new Set(validTopics);
    }
  }

  // Parse Last-Event-ID for resumption after reconnect (clamp to non-negative)
  const lastEventIdHeader = req.headers['last-event-id'];
  let lastSeq = 0;
  if (lastEventIdHeader) {
    const parsed = parseInt(lastEventIdHeader, 10);
    if (!isNaN(parsed) && parsed > 0) lastSeq = parsed;
  }

  // ---------- Set SSE response headers ----------
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no', // nginx / Vercel proxy buffering bypass
    'X-Content-Type-Options': 'nosniff',
  });
  res.flushHeaders?.();

  // Send retry instruction and connection confirmation
  res.write('retry: 3000\n\n');
  res.write(`: connected (mode: ${isListenerActive() ? 'push' : 'poll'})\n\n`);

  const connectionStart = Date.now();
  let isOpen = true;
  let flushing = false;
  let pendingFlush = false; // Tracks if a NOTIFY arrived during an active flush

  // ---------- Cleanup (registered BEFORE any async work) ----------
  const cleanup = () => {
    if (!isOpen) return;
    isOpen = false;

    clearInterval(heartbeatTimer);
    clearInterval(pollTimer);
    clearTimeout(ttlTimer);
    if (unsubscribe) unsubscribe();
    decrementConnections(userId);

    try { res.end(); } catch { /* ignore */ }

    // Opportunistic cleanup of old events (debounced internally)
    cleanupOldEvents(60).catch(() => {});
  };

  req.on('close', cleanup);
  req.on('error', cleanup);

  // ---------- Initial flush (protected) ----------
  try {
    lastSeq = await flushEvents(res, userId, lastSeq, topicFilter);
  } catch (err) {
    console.error('[SSE] Initial flush error:', err.message);
    // Connection is usable — subsequent polls/pushes will retry
  }

  // ---------- Dedicated TTL timer ----------
  // Fires exactly at the TTL deadline, independent of poll/push cycles.
  // Sends a reconnect event so the client reconnects immediately.
  const ttlTimer = setTimeout(() => {
    if (!isOpen) return;
    try {
      res.write('event: reconnect\ndata: {"reason":"ttl"}\n\n');
    } catch { /* ignore */ }
    cleanup();
  }, CONNECTION_TTL_MS);

  // ---------- Heartbeat timer ----------
  const heartbeatTimer = setInterval(() => {
    if (!isOpen) return;
    try {
      res.write(`:heartbeat ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, HEARTBEAT_INTERVAL_MS);

  // ---------- LISTEN-based push (primary) ----------
  let unsubscribe = null;

  if (isListenerActive()) {
    // Subscribe to pg NOTIFY for this user.
    // Uses a "flush-again" pattern instead of dropping events:
    //   - If a NOTIFY arrives during an active flush, set pendingFlush=true
    //   - When the flush completes, if pendingFlush is set, immediately re-flush
    //   - This guarantees no event is delayed by more than one flush cycle
    unsubscribe = subscribe(userId, async () => {
      if (!isOpen) return;

      if (flushing) {
        pendingFlush = true;
        return;
      }

      flushing = true;
      try {
        do {
          pendingFlush = false;
          lastSeq = await flushEvents(res, userId, lastSeq, topicFilter);
        } while (pendingFlush && isOpen);
      } catch (err) {
        console.error('[SSE] Push flush error:', err.message);
      } finally {
        flushing = false;
      }
    });
  }

  // ---------- Poll timer (fallback / safety net) ----------
  // When LISTEN is active: infrequent safety-net poll (30s)
  // When LISTEN is down:   legacy fast poll (3s)
  const pollInterval = isListenerActive() ? SAFETY_POLL_MS : LEGACY_POLL_MS;

  const pollTimer = setInterval(async () => {
    if (!isOpen) return;

    try {
      lastSeq = await flushEvents(res, userId, lastSeq, topicFilter);
    } catch (err) {
      console.error('[SSE] Poll error:', err.message);
    }
  }, pollInterval);
};

// ---------- JSON Poll Endpoint ----------

/**
 * GET /api/sse/poll?lastSeq=0&topics=...
 * GET /api/realtime/poll
 *
 * Lightweight JSON endpoint for edge-function polling or
 * clients that can't use SSE (e.g., React Native background).
 */
export const ssePoll = async (req, res) => {
  const userId = req.user?.id || req.userRef;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const parsedSeq = parseInt(req.query.lastSeq, 10);
  const lastSeq = (!isNaN(parsedSeq) && parsedSeq > 0) ? parsedSeq : 0;

  // Optional topic filter (same validation as stream endpoint)
  const topicsParam = req.query.topics;
  let topicFilter = null;
  if (topicsParam) {
    const topics = topicsParam.split(',').map((t) => t.trim()).filter(Boolean).slice(0, MAX_TOPIC_FILTERS);
    const validTopics = topics.filter((t) => /^[\w.]+$/.test(t) && t.length <= 50);
    if (validTopics.length > 0) {
      topicFilter = new Set(validTopics);
    }
  }

  const where = {
    userId,
    seq: { gt: lastSeq },
    ...(topicFilter && topicFilter.size > 0
      ? { type: { in: [...topicFilter] } }
      : {}),
  };

  const events = await prisma.sSEEvent.findMany({
    where,
    orderBy: { seq: 'asc' },
    take: MAX_EVENTS_PER_FLUSH,
    select: { seq: true, type: true, payload: true },
  });

  return res.json({ events });
};

// ---------- Health / Metrics Endpoint ----------

/**
 * GET /api/sse/health
 * GET /api/realtime/health
 *
 * Health check for the real-time subsystem.
 * Omits subscriber count from public response to avoid leaking operational data.
 */
export const sseHealth = (req, res) => {
  res.json({
    mode: isListenerActive() ? 'push' : 'poll',
    heartbeatMs: HEARTBEAT_INTERVAL_MS,
    ttlMs: CONNECTION_TTL_MS,
    pollMs: isListenerActive() ? SAFETY_POLL_MS : LEGACY_POLL_MS,
  });
};

// ---------- Internal Helpers ----------

/**
 * Flush all SSEEvent rows for a user with seq > lastSeq.
 * Writes them to the SSE response stream and returns the updated lastSeq.
 * Checks res.write() backpressure — if the client buffer is full, stops writing
 * to prevent unbounded memory growth (slow mobile clients on 2G).
 *
 * @param {import('express').Response} res
 * @param {string} userId
 * @param {number} lastSeq
 * @param {Set<string> | null} topicFilter
 * @returns {Promise<number>} updated lastSeq
 */
async function flushEvents(res, userId, lastSeq, topicFilter) {
  const where = {
    userId,
    seq: { gt: lastSeq },
    ...(topicFilter && topicFilter.size > 0
      ? { type: { in: [...topicFilter] } }
      : {}),
  };

  const events = await prisma.sSEEvent.findMany({
    where,
    orderBy: { seq: 'asc' },
    take: MAX_EVENTS_PER_FLUSH,
  });

  for (const event of events) {
    // Sanitize event.type to prevent SSE frame injection via newlines
    const safeType = event.type.replace(/[\r\n]/g, '');

    const sseMessage =
      `id: ${event.seq}\n` +
      `event: ${safeType}\n` +
      `data: ${JSON.stringify(event.payload)}\n\n`;

    const canContinue = res.write(sseMessage);
    lastSeq = event.seq;

    // Backpressure: if the kernel send buffer is full, the client is too slow.
    // Stop writing to prevent unbounded memory growth. The next flush cycle
    // will pick up remaining events via lastSeq tracking.
    if (!canContinue) {
      break;
    }
  }

  return lastSeq;
}
