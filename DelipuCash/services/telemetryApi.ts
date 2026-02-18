/**
 * TelemetryBuffer — Singleton event buffer for video feed telemetry
 *
 * Architecture:
 * - Plain JS class (NOT a hook or store) — avoids re-renders at 250ms intervals
 * - In-memory ring buffer (max 100 events) with periodic batch flush
 * - Flush triggers: every 5s timer OR 20 events accumulated
 * - AppState-aware: flushes on app background/inactive
 * - Fire-and-forget via fetch with keepalive (telemetry never crashes the app)
 *
 * Usage in components:
 *   import { telemetry } from '@/services/telemetryApi';
 *   telemetry.track({ videoId, eventType: 'impression', videoIndex: 0, payload: {} });
 *
 * Initialization (in _layout.tsx):
 *   telemetry.init();
 *   // On unmount: telemetry.destroy();
 */

import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/utils/auth/store';

// ============================================================================
// TYPES
// ============================================================================

export type VideoEventType =
  | 'impression'    // Video entered viewport at 60%+ visibility
  | 'play_3s'       // Watched at least 3 seconds
  | 'play_25pct'    // Reached 25% of video
  | 'play_50pct'    // Reached 50% of video
  | 'play_75pct'    // Reached 75% of video
  | 'play_100pct'   // Reached 100% of video (completion)
  | 'skip'          // Scrolled away before 3s of playback
  | 'rewatch'       // Video looped or user sought to beginning
  | 'dwell'         // Total viewport dwell time snapshot (sent on exit)
  | 'like'
  | 'bookmark'
  | 'share'
  | 'comment';

export interface VideoEvent {
  videoId: string;
  eventType: VideoEventType;
  payload: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  videoIndex: number;
}

export interface TrackParams {
  videoId: string;
  eventType: VideoEventType;
  videoIndex: number;
  payload?: Record<string, unknown>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FLUSH_INTERVAL_MS = 5000;   // Flush every 5 seconds
const FLUSH_THRESHOLD = 20;       // Flush when 20 events accumulated
const MAX_BUFFER_SIZE = 100;      // Ring buffer cap (prevents OOM on long sessions)

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';
const API_BASE_URL = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');

// ============================================================================
// TELEMETRY BUFFER (Singleton)
// ============================================================================

class TelemetryBuffer {
  private buffer: VideoEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private sessionId: string = '';
  private initialized = false;

  private static instance: TelemetryBuffer;

  static getInstance(): TelemetryBuffer {
    if (!TelemetryBuffer.instance) {
      TelemetryBuffer.instance = new TelemetryBuffer();
    }
    return TelemetryBuffer.instance;
  }

  /**
   * Initialize the telemetry session. Call once on app mount.
   * Generates a unique session ID, starts the flush timer, and
   * registers an AppState listener for background flushing.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.startFlushTimer();

    // Flush on app background/inactive
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          this.flush();
        }
      }
    );
  }

  /**
   * Track a single video event. Adds to buffer and auto-flushes
   * when threshold is reached.
   */
  track(params: TrackParams): void {
    if (!this.initialized) return;

    const event: VideoEvent = {
      videoId: params.videoId,
      eventType: params.eventType,
      videoIndex: params.videoIndex,
      payload: params.payload || {},
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    // Ring buffer: drop oldest if full
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.buffer.push(event);

    if (this.buffer.length >= FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  /**
   * Flush all buffered events to the server.
   * Fire-and-forget — errors are silently ignored.
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0); // Drain buffer
    this.sendBatch(batch).catch(() => {
      // Silent failure — telemetry must never crash the app
    });
  }

  /**
   * Clean up: flush remaining events, stop timer, remove listeners.
   * Call on app unmount.
   */
  destroy(): void {
    this.flush();
    this.stopFlushTimer();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.initialized = false;
  }

  /** Get current session ID (useful for debugging) */
  getSessionId(): string {
    return this.sessionId;
  }

  // --------------------------------------------------------------------------
  // PRIVATE
  // --------------------------------------------------------------------------

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async sendBatch(events: VideoEvent[]): Promise<void> {
    const token = useAuthStore.getState().auth?.token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch(`${API_BASE_URL}/api/videos/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        events,
        sessionId: this.sessionId,
        sentAt: Date.now(),
      }),
      // @ts-expect-error -- keepalive is valid in React Native fetch
      keepalive: true,
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton telemetry instance — import and use directly */
export const telemetry = TelemetryBuffer.getInstance();
