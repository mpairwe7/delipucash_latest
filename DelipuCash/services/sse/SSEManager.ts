/**
 * SSEManager — Core SSE connection manager for React Native
 *
 * Uses native fetch() + ReadableStream (no EventSource polyfill needed).
 * Manages connection lifecycle: connect, parse, reconnect, disconnect.
 * App-state aware (foreground/background) and network-aware (online/offline).
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAuthStore } from '@/utils/auth/store';
import type { SSEEventType, SSEConnectionStatus } from './types';

type EventHandler = (data: unknown) => void;

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';
const NORMALIZED_API_URL = API_URL.replace(/\/+$/, '');
const HAS_API_SUFFIX = /\/api$/i.test(NORMALIZED_API_URL);
const SSE_ENDPOINT_CANDIDATES = Array.from(
  new Set(
    HAS_API_SUFFIX
      ? [
          `${NORMALIZED_API_URL}/sse/stream`,
          `${NORMALIZED_API_URL.replace(/\/api$/i, '')}/api/sse/stream`,
        ]
      : [
          `${NORMALIZED_API_URL}/api/sse/stream`,
          `${NORMALIZED_API_URL}/sse/stream`,
        ],
  ),
);

// Reconnection constants
const BASE_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 60000;
const MAX_RECONNECT_ATTEMPTS = 15;
const JITTER_FACTOR = 0.3;

// Event batching — groups rapid events to prevent cache thrashing
const BATCH_WINDOW_MS = 500;

export class SSEManager {
  private abortController: AbortController | null = null;
  private lastEventId: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private statusListeners = new Set<(status: SSEConnectionStatus) => void>();
  private _status: SSEConnectionStatus = 'disconnected';
  private isAppActive = true;
  private isOnline = true;
  private appStateSubscription: { remove: () => void } | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  // Event batching state
  private eventBatch: Array<{ type: SSEEventType; data: unknown }> = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.setupAppStateListener();
    this.setupNetworkListener();
  }

  get status(): SSEConnectionStatus {
    return this._status;
  }

  private setStatus(status: SSEConnectionStatus) {
    this._status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => {
      this.handlers.get(eventType)?.delete(handler);
      if (this.handlers.get(eventType)?.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  /** Subscribe to connection status changes. */
  onStatusChange(
    listener: (status: SSEConnectionStatus) => void,
  ): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Start the SSE connection. */
  async connect(): Promise<void> {
    if (this._status === 'connecting' || this._status === 'connected') return;
    if (!this.isAppActive || !this.isOnline) return;

    const token = useAuthStore.getState().auth?.token;
    if (!token) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('connecting');

    try {
      this.abortController = new AbortController();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      };

      if (this.lastEventId) {
        headers['Last-Event-ID'] = this.lastEventId;
      }

      const requestOptions: RequestInit = {
        method: 'GET',
        headers,
        signal: this.abortController.signal,
      };

      let endpointUsed = SSE_ENDPOINT_CANDIDATES[0];
      let response = await fetch(endpointUsed, requestOptions);

      // Handle API base-url shape differences:
      // - EXPO_PUBLIC_API_URL=https://host
      // - EXPO_PUBLIC_API_URL=https://host/api
      if (response.status === 404 && SSE_ENDPOINT_CANDIDATES.length > 1) {
        const fallbackEndpoint = SSE_ENDPOINT_CANDIDATES[1];
        const fallbackResponse = await fetch(fallbackEndpoint, requestOptions);
        if (fallbackResponse.ok || fallbackResponse.status !== 404) {
          endpointUsed = fallbackEndpoint;
          response = fallbackResponse;
        } else {
          throw new Error(
            `SSE endpoint not found. Tried: ${SSE_ENDPOINT_CANDIDATES.join(' | ')}`,
          );
        }
      } else if (response.status === 404) {
        throw new Error(`SSE endpoint not found at ${endpointUsed}`);
      }

      if (!response.ok) {
        throw new Error(
          `SSE connection failed: HTTP ${response.status} (${endpointUsed})`,
        );
      }

      if (!response.body) {
        throw new Error('SSE response has no body');
      }

      this.setStatus('connected');
      this.reconnectAttempt = 0;

      await this.processStream(response.body);
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'AbortError') return;
      console.warn('[SSE] Connection error:', err.message);

      // Endpoint is missing in the backend deployment/config;
      // do not spam reconnect loops for a permanent 404.
      if (err.message?.includes('SSE endpoint not found')) {
        this.setStatus('disconnected');
        return;
      }

      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  /** Parse the SSE text protocol from a ReadableStream. */
  private async processStream(
    body: ReadableStream<Uint8Array>,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let currentId = '';
    let currentEvent = '';
    let currentData = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line === '') {
            // Empty line = end of event
            if (currentData) {
              this.handleParsedEvent(currentId, currentEvent, currentData);
            }
            currentId = '';
            currentEvent = '';
            currentData = '';
          } else if (line.startsWith('id: ')) {
            currentId = line.slice(4).trim();
          } else if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData += (currentData ? '\n' : '') + line.slice(6);
          } else if (line.startsWith('retry: ')) {
            // Server-specified retry — we manage our own backoff
          } else if (line.startsWith(':')) {
            // Comment (heartbeat) — connection is alive
          }
        }
      }
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name !== 'AbortError') {
        console.warn('[SSE] Stream read error:', err.message);
      }
    } finally {
      reader.releaseLock();
      if (this._status === 'connected') {
        this.setStatus('disconnected');
        // TTL-based close: immediate reconnect
        this.reconnectAttempt = 0;
        this.scheduleReconnect(0);
      }
    }
  }

  /** Handle a fully parsed SSE event. */
  private handleParsedEvent(
    id: string,
    event: string,
    data: string,
  ): void {
    if (id) this.lastEventId = id;
    if (event === 'reconnect') return;

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = data;
    }

    this.eventBatch.push({ type: event as SSEEventType, data: parsedData });

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushEventBatch(), BATCH_WINDOW_MS);
    }
  }

  /** Flush batched events to handlers. Deduplicates rapid identical events. */
  private flushEventBatch(): void {
    this.batchTimer = null;
    const batch = [...this.eventBatch];
    this.eventBatch = [];

    const deduped = new Map<string, { type: SSEEventType; data: unknown }>();
    for (const event of batch) {
      const key = `${event.type}:${JSON.stringify(event.data)}`;
      deduped.set(key, event);
    }

    for (const event of deduped.values()) {
      const handlers = this.handlers.get(event.type);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(event.data);
          } catch (err) {
            console.error(`[SSE] Handler error for ${event.type}:`, err);
          }
        });
      }

      // Wildcard handlers (for debugging/logging)
      const wildcardHandlers = this.handlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => {
          try {
            handler({ type: event.type, data: event.data });
          } catch (err) {
            console.error('[SSE] Wildcard handler error:', err);
          }
        });
      }
    }
  }

  /** Schedule reconnection with exponential backoff + jitter. */
  private scheduleReconnect(overrideDelay?: number): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.isAppActive || !this.isOnline) return;
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[SSE] Max reconnect attempts reached, falling back to polling');
      this.setStatus('error');
      return;
    }

    const baseDelay =
      overrideDelay ??
      Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempt),
        MAX_RECONNECT_DELAY,
      );
    const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
    const delay = Math.max(0, baseDelay + jitter);

    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /** Disconnect the SSE connection. */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.flushEventBatch();
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setStatus('disconnected');
  }

  /** Listen for app state changes (foreground/background). */
  private setupAppStateListener(): void {
    if (Platform.OS === 'web') return;
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        const wasActive = this.isAppActive;
        this.isAppActive = state === 'active';

        if (this.isAppActive && !wasActive) {
          this.connect();
        } else if (!this.isAppActive && wasActive) {
          this.setStatus('backgrounded');
          this.disconnect();
        }
      },
    );
  }

  /** Listen for network state changes. */
  private setupNetworkListener(): void {
    if (Platform.OS === 'web') return;
    this.netInfoUnsubscribe = NetInfo.addEventListener(
      (state: NetInfoState) => {
        const wasOnline = this.isOnline;
        this.isOnline = !!state.isConnected;

        if (this.isOnline && !wasOnline) {
          this.reconnectAttempt = 0;
          this.connect();
        } else if (!this.isOnline && wasOnline) {
          this.disconnect();
        }
      },
    );
  }

  /** Cleanup all listeners and connections. */
  destroy(): void {
    this.disconnect();
    this.handlers.clear();
    this.statusListeners.clear();
    this.appStateSubscription?.remove();
    this.netInfoUnsubscribe?.();
  }
}

// Singleton instance
let _instance: SSEManager | null = null;

export function getSSEManager(): SSEManager {
  if (!_instance) {
    _instance = new SSEManager();
  }
  return _instance;
}
