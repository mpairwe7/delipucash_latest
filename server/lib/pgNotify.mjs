import pg from 'pg';
import 'dotenv/config';

/**
 * PostgreSQL LISTEN/NOTIFY Connection Manager
 *
 * Maintains a single dedicated direct Postgres connection for LISTEN.
 * LISTEN does NOT work through PgBouncer (transaction mode), so we use
 * DIRECT_DATABASE_URL (port 5432) instead of the pooled DATABASE_URL (port 6543).
 *
 * Architecture:
 *   - SSEEvent INSERT trigger fires pg_notify('sse_events', payload)
 *   - Business table triggers fire pg_notify('db_changes', payload)
 *   - This module LISTENs on both channels and dispatches to in-memory subscribers
 *   - Subscribers are keyed by userId (SSE connections register/unregister)
 *
 * Channels:
 *   sse_events  — fired when a new SSEEvent row is inserted (rich, structured events)
 *   db_changes  — fired by triggers on business tables (lightweight invalidation)
 *
 * Limits:
 *   - PostgreSQL pg_notify has an 8KB (8000 byte) payload limit.
 *     All trigger payloads send only metadata (userId, type, seq, table, id) — well under 200 bytes.
 *   - The LISTEN connection is a single dedicated pg.Client, NOT pooled.
 *     On Vercel serverless, each function instance gets its own connection.
 */

// ---------- Configuration ----------

const DIRECT_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 20;
const CONNECTION_TIMEOUT_MS = 10_000;

const CHANNEL_SSE_EVENTS = 'sse_events';
const CHANNEL_DB_CHANGES = 'db_changes';

// ---------- State ----------

/** @type {Map<string, Set<Function>>} userId → Set<callback> */
const subscribers = new Map();

/** @type {pg.Client | null} */
let listenerClient = null;
let isConnected = false;
let isConnecting = false; // Mutex guard to prevent concurrent initListener calls
let reconnectTimer = null;
let reconnectAttempts = 0;

// ---------- Public API ----------

/**
 * Initialize the dedicated LISTEN connection.
 * Call once at server startup. Safe to call multiple times (idempotent).
 * Uses an isConnecting mutex to prevent concurrent connection attempts.
 */
export async function initListener() {
  if (isConnected || isConnecting) return;

  if (!DIRECT_URL) {
    console.warn('[PgNotify] No DIRECT_DATABASE_URL — LISTEN/NOTIFY disabled, SSE falls back to polling');
    return;
  }

  isConnecting = true;

  try {
    listenerClient = new pg.Client({
      connectionString: DIRECT_URL,
      // Keepalive prevents idle connection drops by cloud load balancers
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      // Prevent hanging on degraded Supabase — fail fast on cold start
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    });

    listenerClient.on('error', (err) => {
      console.error('[PgNotify] Connection error:', err.message);
      handleDisconnect();
    });

    listenerClient.on('end', () => {
      if (isConnected) {
        console.warn('[PgNotify] Connection ended unexpectedly');
        handleDisconnect();
      }
    });

    listenerClient.on('notification', handleNotification);

    await listenerClient.connect();

    await listenerClient.query(`LISTEN ${CHANNEL_SSE_EVENTS}`);
    await listenerClient.query(`LISTEN ${CHANNEL_DB_CHANGES}`);

    isConnected = true;
    reconnectAttempts = 0;
    console.log(`[PgNotify] LISTEN active on channels: ${CHANNEL_SSE_EVENTS}, ${CHANNEL_DB_CHANGES}`);
  } catch (error) {
    console.error('[PgNotify] Failed to connect:', error.message);
    // Clean up partially-initialized client to prevent connection leak
    if (listenerClient) {
      listenerClient.removeAllListeners();
      try { listenerClient.end(); } catch { /* ignore */ }
      listenerClient = null;
    }
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
}

/**
 * Subscribe to real-time events for a specific user.
 * Returns an unsubscribe function for cleanup on disconnect.
 *
 * @param {string} userId
 * @param {(event: { channel: string, type: string, table?: string, operation?: string, payload: object }) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribe(userId, callback) {
  if (!userId || typeof userId !== 'string') return () => {};

  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set());
  }
  subscribers.get(userId).add(callback);

  return () => {
    const userSubs = subscribers.get(userId);
    if (userSubs) {
      userSubs.delete(callback);
      if (userSubs.size === 0) {
        subscribers.delete(userId);
      }
    }
  };
}

/**
 * Whether the LISTEN connection is active.
 * Used by the SSE controller to decide between push and polling mode.
 */
export function isListenerActive() {
  return isConnected;
}

/**
 * Total number of active subscriber callbacks across all users.
 * Useful for health/metrics endpoints.
 */
export function getSubscriberCount() {
  let count = 0;
  for (const subs of subscribers.values()) {
    count += subs.size;
  }
  return count;
}

/**
 * Number of unique users with active subscriptions.
 */
export function getUniqueUserCount() {
  return subscribers.size;
}

/**
 * Graceful shutdown. Call on process exit / SIGTERM.
 */
export async function shutdownListener() {
  isConnected = false;
  isConnecting = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (listenerClient) {
    listenerClient.removeAllListeners();
    try {
      await listenerClient.end();
    } catch { /* ignore — already closing */ }
    listenerClient = null;
  }

  subscribers.clear();
  console.log('[PgNotify] Listener shut down');
}

// ---------- Internals ----------

/**
 * Dispatch incoming PostgreSQL notification to matching subscribers.
 * @param {{ channel: string, payload: string }} msg
 */
function handleNotification(msg) {
  try {
    const data = JSON.parse(msg.payload);
    const userId = data.userId;

    if (!userId) {
      console.warn('[PgNotify] Notification missing userId, channel:', msg.channel);
      return;
    }

    const userSubs = subscribers.get(userId);
    if (!userSubs || userSubs.size === 0) return;

    const event = {
      channel: msg.channel,
      type: data.type || `${data.table || 'unknown'}.${(data.operation || 'change').toLowerCase()}`,
      table: data.table,
      operation: data.operation,
      payload: data,
    };

    for (const callback of userSubs) {
      try {
        callback(event);
      } catch (err) {
        console.error('[PgNotify] Subscriber callback error:', err.message);
      }
    }
  } catch {
    // Non-JSON payload — log for debugging trigger issues
    console.warn('[PgNotify] Non-JSON notification payload:', String(msg.payload).slice(0, 200));
  }
}

/**
 * Handle disconnection with cleanup and scheduled reconnect.
 * Safe to call from both 'error' and 'end' events — the first call
 * removes all listeners to prevent the second from re-entering.
 */
function handleDisconnect() {
  if (!isConnected && !listenerClient) return; // already handled
  isConnected = false;

  if (listenerClient) {
    // Remove listeners FIRST to prevent re-entrant calls from 'end' after 'error'
    listenerClient.removeAllListeners();
    try { listenerClient.end(); } catch { /* ignore */ }
    listenerClient = null;
  }

  scheduleReconnect();
}

/**
 * Schedule reconnection with exponential backoff + jitter (capped at 30s).
 * Jitter prevents thundering herd when multiple instances reconnect simultaneously.
 */
function scheduleReconnect() {
  if (reconnectTimer) return;

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[PgNotify] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — LISTEN permanently disabled. Restart server to retry.`);
    return;
  }

  const baseDelay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY_MS,
  );
  // Full jitter: random delay between 50%-100% of base to prevent synchronized reconnection storms
  const delay = Math.round(baseDelay * (0.5 + Math.random() * 0.5));
  reconnectAttempts++;

  console.log(`[PgNotify] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await initListener();
  }, delay);
}
