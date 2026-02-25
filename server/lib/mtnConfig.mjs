/**
 * MTN MoMo — Centralized Configuration
 *
 * Provides:
 *  - Environment-driven base URL (sandbox vs production)
 *  - OAuth token caching (separate per product, 30s safety margin)
 *  - Currency & amount helpers (EUR for sandbox, UGX for production)
 *  - Phone number formatter
 *  - Header builder
 *
 * Shared exports used by airtelConfig.mjs:
 *  - isSandbox, tokenCache, EXPIRY_BUFFER_MS, invalidateTokenCache
 *
 * @module lib/mtnConfig
 */

import axios from 'axios';
import { createPaymentLogger } from './paymentLogger.mjs';
import { getBreaker } from './circuitBreaker.mjs';

const log = createPaymentLogger('mtn');
const breaker = getBreaker('mtn');

// ---------------------------------------------------------------------------
// Environment-derived constants
// ---------------------------------------------------------------------------

export const MTN_TARGET_ENV = process.env.X_TARGET_ENVIRONMENT || 'sandbox';
export const isSandbox = MTN_TARGET_ENV === 'sandbox';

export const MTN_BASE_URL = process.env.MTN_BASE_URL ||
  (isSandbox
    ? 'https://sandbox.momodeveloper.mtn.com'
    : 'https://proxy.momoapi.mtn.com');

export const MTN_CURRENCY = isSandbox ? 'EUR' : 'UGX';

// Approx EUR/UGX rate used for sandbox only
const SANDBOX_EUR_RATE = 4000;

// ---------------------------------------------------------------------------
// Environment validation (runs once at import time)
// ---------------------------------------------------------------------------

const validateMtnEnv = () => {
  const missing = [];
  ['MTN_USER_ID', 'MTN_API_KEY', 'MTN_PRIMARY_KEY'].forEach(v => {
    if (!process.env[v]) missing.push(v);
  });
  if (missing.length > 0) {
    log.warn('Missing env vars — MTN payments will fail', { missing });
  }
};

validateMtnEnv();

// ---------------------------------------------------------------------------
// Token cache (shared with airtelConfig via export)
// ---------------------------------------------------------------------------

/** @type {Record<string, { token: string, expiresAt: number }>} */
export const tokenCache = {};

/** @type {Record<string, Promise<string>>} */
const inflightRequests = {};

// Safety margin: expire 10 minutes early (MTN recommended) to avoid using nearly-expired tokens
export const EXPIRY_BUFFER_MS = 600_000;

/**
 * Get an OAuth token for an MTN product (collection | disbursement).
 * Tokens are cached per product and refreshed 10 min before actual expiry.
 * Concurrent requests for the same product coalesce into a single API call.
 */
export const getMtnToken = async (product = 'collection') => {
  const cacheKey = `mtn:${product}`;
  const cached = tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  // Coalesce concurrent refresh requests (thundering herd guard)
  if (inflightRequests[cacheKey]) {
    return inflightRequests[cacheKey];
  }

  const fetchToken = async () => {
    const userId = process.env.MTN_USER_ID;
    const apiKey = process.env.MTN_API_KEY;
    const subscriptionKey = product === 'disbursement'
      ? (process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY)
      : process.env.MTN_PRIMARY_KEY;

    if (!userId || !apiKey || !subscriptionKey) {
      throw new Error(`Missing MTN credentials for ${product}`);
    }

    try {
      const credentials = Buffer.from(`${userId}:${apiKey}`).toString('base64');
      const response = await breaker.exec(() =>
        axios.post(
          `${MTN_BASE_URL}/${product}/token/`,
          {},
          {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Ocp-Apim-Subscription-Key': subscriptionKey,
            },
            timeout: 15_000,
          }
        )
      );

      const { access_token, expires_in } = response.data;
      const expiresAt = Date.now() + (expires_in * 1000) - EXPIRY_BUFFER_MS;

      tokenCache[cacheKey] = { token: access_token, expiresAt };
      log.info(`Fresh ${product} token acquired`, { expiresIn: expires_in });
      return access_token;
    } catch (error) {
      if (error.circuitOpen) {
        log.warn('Circuit open — skipping token request', { product, retryAfterMs: error.retryAfterMs });
        throw error;
      }
      log.error(`MTN ${product} token error`, {
        status: error.response?.status,
        message: error.message,
      });
      throw new Error(`MTN API Error (${product}): ${error.response?.data?.message || error.message}`);
    }
  };

  inflightRequests[cacheKey] = fetchToken().finally(() => {
    delete inflightRequests[cacheKey];
  });

  return inflightRequests[cacheKey];
};

/** Clear all cached tokens (useful for tests or credential rotation). */
export const invalidateTokenCache = () => {
  for (const key of Object.keys(tokenCache)) {
    delete tokenCache[key];
  }
  console.log('[mtnConfig] Token cache cleared');
};

// ---------------------------------------------------------------------------
// Amount & currency helpers
// ---------------------------------------------------------------------------

/**
 * Convert a UGX amount to the correct API amount.
 * Sandbox: converts to EUR (min 1). Production: pass-through.
 */
export const convertAmount = (ugxAmount) => {
  if (!isSandbox) return ugxAmount;
  return Math.max(1, Math.round(ugxAmount / SANDBOX_EUR_RATE));
};

// ---------------------------------------------------------------------------
// Phone number formatter
// ---------------------------------------------------------------------------

/**
 * Normalize a phone number to MTN's required `256XXXXXXXXX` format.
 * Validates the result is a 12-digit Uganda MSISDN.
 * @throws {Error} if the phone number cannot be normalized to a valid format
 */
export const formatMtnPhone = (phone) => {
  let formatted = String(phone || '').replace(/[\s+]/g, '');
  if (formatted.startsWith('0') && formatted.length === 10) {
    formatted = `256${formatted.substring(1)}`;
  } else if (/^7\d{8}$/.test(formatted)) {
    formatted = `256${formatted}`;
  } else if (!formatted.startsWith('256')) {
    formatted = `256${formatted}`;
  }

  // Validate: must be exactly 12 digits starting with 256
  if (!/^256\d{9}$/.test(formatted)) {
    throw new Error(`Invalid MTN phone number: expected 256XXXXXXXXX, got ${formatted.substring(0, 6)}...`);
  }

  return formatted;
};

// ---------------------------------------------------------------------------
// Header builder
// ---------------------------------------------------------------------------

export const MTN_CALLBACK_URL = process.env.MTN_CALLBACK_URL || '';

/**
 * Build the full MTN API headers object.
 * @param {string} token - Bearer token
 * @param {string} [referenceId] - X-Reference-Id (for POST requests)
 * @param {'collection'|'disbursement'} [product] - Determines subscription key
 */
export const getMtnHeaders = (token, referenceId, product = 'collection') => {
  const subscriptionKey = product === 'disbursement'
    ? (process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY)
    : process.env.MTN_PRIMARY_KEY;

  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Target-Environment': MTN_TARGET_ENV,
    'Ocp-Apim-Subscription-Key': subscriptionKey,
    'Content-Type': 'application/json',
  };

  if (referenceId) {
    headers['X-Reference-Id'] = referenceId;
  }

  // Production callback URL (HTTPS only — callbacks don't work in sandbox)
  if (MTN_CALLBACK_URL && !isSandbox) {
    headers['X-Callback-Url'] = MTN_CALLBACK_URL;
  }

  return headers;
};
