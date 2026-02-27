/**
 * Tawk.to Configuration & Health Check
 *
 * Centralises Tawk.to env-var validation so every consumer
 * (live-chat screen, supportApi, ContactCard) uses one source of truth.
 *
 * FIX: Previously TAWK_WIDGET_ID silently fell back to "default", producing
 *      an invalid embed URL (https://embed.tawk.to/{property}/default) that
 *      loaded a script which never called onLoad → 20 s timeout → "Offline".
 */

// ---------------------------------------------------------------------------
// Granular error states for the live-chat screen
// ---------------------------------------------------------------------------

export type ChatErrorKind =
  /** Both TAWK_PROPERTY_ID and TAWK_WIDGET_ID are present and non-empty */
  | 'NONE'
  /** One or both env vars are missing / empty → build/config problem */
  | 'CONFIG_ERROR'
  /** WebView onError / onHttpError fired → device is offline or Tawk CDN down */
  | 'NETWORK_ERROR'
  /** onShouldStartLoadWithRequest blocked a required navigation */
  | 'BLOCKED_NAVIGATION'
  /** Tawk script loaded but widget never called onLoad within the timeout */
  | 'TIMEOUT';

/** User-facing messages keyed by error kind */
export const CHAT_ERROR_MESSAGES: Record<Exclude<ChatErrorKind, 'NONE'>, string> = {
  CONFIG_ERROR:
    'Live chat is not configured. Please contact support via WhatsApp or email.',
  NETWORK_ERROR:
    'Unable to connect to live chat. Please check your internet connection and try again.',
  BLOCKED_NAVIGATION:
    'Chat failed to initialise (navigation blocked). Please update the app or try again.',
  TIMEOUT:
    'Connection timed out. The chat service may be slow or blocked on this network.',
};

/** Header subtitle text per error kind */
export const CHAT_STATUS_LABELS: Record<Exclude<ChatErrorKind, 'NONE'>, string> = {
  CONFIG_ERROR: 'Not configured',
  NETWORK_ERROR: 'No connection',
  BLOCKED_NAVIGATION: 'Blocked',
  TIMEOUT: 'Timed out',
};

// ---------------------------------------------------------------------------
// Validated config
// ---------------------------------------------------------------------------

export interface TawkConfig {
  propertyId: string;
  widgetId: string;
}

const rawPropertyId = process.env.EXPO_PUBLIC_TAWK_PROPERTY_ID ?? '';
const rawWidgetId = process.env.EXPO_PUBLIC_TAWK_WIDGET_ID ?? '';

/**
 * Returns a validated config object, or `null` when either key is
 * missing / empty / still set to the old "default" sentinel.
 */
export function getTawkConfig(): TawkConfig | null {
  if (!rawPropertyId || !rawWidgetId || rawWidgetId === 'default') {
    return null;
  }
  return { propertyId: rawPropertyId, widgetId: rawWidgetId };
}

/**
 * Quick boolean for UI gating (contact cards, availability badges).
 * Callable from module scope — no hooks required.
 */
export function isTawkConfigured(): boolean {
  return getTawkConfig() !== null;
}
