/**
 * Structured Payment Logger
 *
 * Lightweight logger for the payment subsystem — zero external dependencies.
 *
 * Behaviour by environment:
 *  - **Production** (`NODE_ENV=production`): JSON lines (machine-parseable),
 *    PII always masked, only warn/error/info levels emitted.
 *  - **Sandbox / Development** (default): Human-readable coloured output,
 *    debug level enabled, PII shown in debug logs only.
 *
 * Every log entry carries:
 *  - `ts`          — ISO-8601 timestamp
 *  - `level`       — info | warn | error | debug
 *  - `component`   — originating module (e.g. "mtn", "airtel", "survey-payment")
 *  - `env`         — sandbox | production
 *  - `correlationId` — optional, links logs across a single payment flow
 *  - `msg`         — human-readable message
 *  - `data`        — structured payload (amounts, statuses, etc.)
 *
 * Usage:
 * ```js
 * import { createPaymentLogger } from '../lib/paymentLogger.mjs';
 * const log = createPaymentLogger('mtn');
 *
 * log.info('Collection initiated', { referenceId, amount }, correlationId);
 * log.error('Token fetch failed', { status: 401, message: err.message });
 * log.debug('Full provider response', { body: response.data }); // sandbox only
 * ```
 *
 * @module lib/paymentLogger
 */

// Inline env check to avoid circular dependency with mtnConfig
const isSandbox = (process.env.X_TARGET_ENVIRONMENT || 'sandbox') === 'sandbox';

// ---------------------------------------------------------------------------
// PII masking helpers
// ---------------------------------------------------------------------------

/** Mask a phone number: 256770***456 */
const maskPhone = (phone) => {
  const s = String(phone || '');
  if (s.length <= 6) return '***';
  return `${s.substring(0, 6)}***${s.substring(s.length - 3)}`;
};

/** Mask an email: j***@gmail.com */
const maskEmail = (email) => {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at <= 1) return '***';
  return `${s[0]}***${s.substring(at)}`;
};

/** Mask a token/secret: eyJhb***Rk2 */
const maskSecret = (val) => {
  const s = String(val || '');
  if (s.length <= 8) return '***';
  return `${s.substring(0, 5)}***${s.substring(s.length - 3)}`;
};

/**
 * Deep-clone `data` and mask known PII fields.
 * In sandbox, the original object is returned for full visibility.
 */
const sanitise = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (isSandbox) return data; // Full visibility in sandbox

  const clone = Array.isArray(data) ? [...data] : { ...data };

  const PHONE_KEYS = ['phoneNumber', 'phone', 'msisdn', 'partyId', 'payer', 'payee'];
  const EMAIL_KEYS = ['email', 'userEmail', 'userId'];
  const SECRET_KEYS = ['token', 'access_token', 'accessToken', 'pin', 'apiKey', 'secret'];

  for (const [key, val] of Object.entries(clone)) {
    if (val && typeof val === 'object') {
      clone[key] = sanitise(val);
    } else if (typeof val === 'string') {
      if (PHONE_KEYS.includes(key)) clone[key] = maskPhone(val);
      else if (EMAIL_KEYS.includes(key)) clone[key] = maskEmail(val);
      else if (SECRET_KEYS.includes(key)) clone[key] = maskSecret(val);
    }
  }

  return clone;
};

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.PAYMENT_LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

// ANSI colours for sandbox / development
const COLORS = {
  debug: '\x1b[36m',  // cyan
  info: '\x1b[32m',   // green
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  reset: '\x1b[0m',
};

// ---------------------------------------------------------------------------
// Core emit function
// ---------------------------------------------------------------------------

const emit = (level, component, msg, data, correlationId) => {
  if (LEVELS[level] < minLevel) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    component: `payment:${component}`,
    env: isSandbox ? 'sandbox' : 'production',
    msg,
    ...(correlationId ? { correlationId } : {}),
    ...(data ? { data: sanitise(data) } : {}),
  };

  if (IS_PRODUCTION) {
    // JSON lines — compatible with CloudWatch, Datadog, ELK, etc.
    const output = level === 'error' ? process.stderr : process.stdout;
    output.write(JSON.stringify(entry) + '\n');
  } else {
    // Human-readable coloured output
    const colour = COLORS[level] || '';
    const prefix = `${colour}[${level.toUpperCase()}]${COLORS.reset}`;
    const comp = `\x1b[90m[${entry.component}]\x1b[0m`;
    const cid = correlationId ? ` \x1b[90mcid=${correlationId}\x1b[0m` : '';
    const dataStr = data ? ` ${JSON.stringify(sanitise(data))}` : '';

    const target = level === 'error' ? console.error : console.log;
    target(`${prefix} ${comp}${cid} ${msg}${dataStr}`);
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a scoped payment logger for a specific component.
 *
 * @param {string} component - Module name (e.g. 'mtn', 'airtel', 'survey-payment')
 * @returns {{ info, warn, error, debug }} Logger instance
 */
export const createPaymentLogger = (component) => ({
  info: (msg, data, correlationId) => emit('info', component, msg, data, correlationId),
  warn: (msg, data, correlationId) => emit('warn', component, msg, data, correlationId),
  error: (msg, data, correlationId) => emit('error', component, msg, data, correlationId),
  debug: (msg, data, correlationId) => emit('debug', component, msg, data, correlationId),
});

// Re-export masking utilities for external use (e.g. existing maskPhone calls)
export { maskPhone, maskEmail, maskSecret };
