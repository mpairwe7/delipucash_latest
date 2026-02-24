/**
 * MTN MoMo & Airtel Money — Centralized Configuration
 *
 * Provides:
 *  - Environment-driven base URLs (sandbox vs production)
 *  - OAuth token caching (separate per product, 30s safety margin)
 *  - Currency & amount helpers (EUR for sandbox, UGX for production)
 *  - Phone number formatters
 *  - Header builders
 *
 * @module lib/mtnConfig
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Environment-derived constants
// ---------------------------------------------------------------------------

export const MTN_TARGET_ENV = process.env.X_TARGET_ENVIRONMENT || 'sandbox';
export const isSandbox = MTN_TARGET_ENV === 'sandbox';

export const MTN_BASE_URL = process.env.MTN_BASE_URL ||
  (isSandbox
    ? 'https://sandbox.momodeveloper.mtn.com'
    : 'https://proxy.momoapi.mtn.com');

export const AIRTEL_BASE_URL = process.env.AIRTEL_BASE_URL ||
  (isSandbox
    ? 'https://openapiuat.airtel.africa'
    : 'https://openapi.airtel.africa');

export const MTN_CURRENCY = isSandbox ? 'EUR' : 'UGX';

// Approx EUR/UGX rate used for sandbox only
const SANDBOX_EUR_RATE = 4000;

// ---------------------------------------------------------------------------
// Environment validation (runs once at import time)
// ---------------------------------------------------------------------------

const validateEnvironmentVariables = () => {
  const missing = [];

  ['MTN_USER_ID', 'MTN_API_KEY', 'MTN_PRIMARY_KEY'].forEach(v => {
    if (!process.env[v]) missing.push(v);
  });
  ['AIRTEL_CLIENT_ID', 'AIRTEL_CLIENT_SECRET'].forEach(v => {
    if (!process.env[v]) missing.push(v);
  });

  if (missing.length > 0) {
    console.warn(`[mtnConfig] Missing env vars (payments will fail): ${missing.join(', ')}`);
  }
};

validateEnvironmentVariables();

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

/** @type {Record<string, { token: string, expiresAt: number }>} */
const tokenCache = {};

// Safety margin: expire 30s early so we never send a nearly-expired token
const EXPIRY_BUFFER_MS = 30_000;

/**
 * Get an OAuth token for an MTN product (collection | disbursement).
 * Tokens are cached per product and refreshed 30s before actual expiry.
 */
export const getMtnToken = async (product = 'collection') => {
  const cacheKey = `mtn:${product}`;
  const cached = tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[mtnConfig] Using cached ${product} token`);
    return cached.token;
  }

  const userId = process.env.MTN_USER_ID;
  const apiKey = process.env.MTN_API_KEY;
  const subscriptionKey = product === 'disbursement'
    ? (process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY)
    : process.env.MTN_PRIMARY_KEY;

  if (!userId || !apiKey || !subscriptionKey) {
    throw new Error(`[mtnConfig] Missing MTN credentials for ${product}`);
  }

  try {
    const credentials = Buffer.from(`${userId}:${apiKey}`).toString('base64');
    const response = await axios.post(
      `${MTN_BASE_URL}/${product}/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      }
    );

    const { access_token, expires_in } = response.data;
    const expiresAt = Date.now() + (expires_in * 1000) - EXPIRY_BUFFER_MS;

    tokenCache[cacheKey] = { token: access_token, expiresAt };
    console.log(`[mtnConfig] Fresh ${product} token acquired (expires in ${expires_in}s)`);
    return access_token;
  } catch (error) {
    console.error(`[mtnConfig] MTN ${product} token error:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw new Error(`MTN API Error (${product}): ${error.response?.data?.message || error.message}`);
  }
};

/**
 * Get an OAuth token for the Airtel API.
 * Cached with the same pattern as MTN tokens.
 */
export const getAirtelToken = async () => {
  const cacheKey = 'airtel';
  const cached = tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt) {
    console.log('[mtnConfig] Using cached Airtel token');
    return cached.token;
  }

  try {
    const response = await axios.post(
      `${AIRTEL_BASE_URL}/auth/oauth2/token`,
      {
        client_id: process.env.AIRTEL_CLIENT_ID,
        client_secret: process.env.AIRTEL_CLIENT_SECRET,
        grant_type: 'client_credentials',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: '*/*',
        },
      }
    );

    const { access_token, expires_in } = response.data;
    // Airtel tokens typically have expires_in; default to 1 hour if missing
    const ttl = (expires_in || 3600) * 1000;
    const expiresAt = Date.now() + ttl - EXPIRY_BUFFER_MS;

    tokenCache[cacheKey] = { token: access_token, expiresAt };
    console.log(`[mtnConfig] Fresh Airtel token acquired (expires in ${expires_in || 3600}s)`);
    return access_token;
  } catch (error) {
    console.error('[mtnConfig] Airtel token error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw new Error(`Airtel API Error: ${error.response?.data?.message || error.message}`);
  }
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
// Phone number formatters
// ---------------------------------------------------------------------------

/**
 * Normalize a phone number to MTN's required `256XXXXXXXXX` format.
 */
export const formatMtnPhone = (phone) => {
  let formatted = phone.replace(/[\s+]/g, '');
  if (formatted.startsWith('0')) {
    formatted = `256${formatted.substring(1)}`;
  } else if (!formatted.startsWith('256')) {
    formatted = `256${formatted}`;
  }
  return formatted;
};

/**
 * Strip country code to local format for Airtel (e.g. 7XXXXXXXX).
 */
export const formatAirtelPhone = (phone) => {
  let formatted = phone.replace(/[\s+]/g, '');
  if (formatted.startsWith('256')) {
    formatted = formatted.substring(3);
  } else if (formatted.startsWith('0')) {
    formatted = formatted.substring(1);
  }
  return formatted;
};

// ---------------------------------------------------------------------------
// Header builders
// ---------------------------------------------------------------------------

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

  return headers;
};

/**
 * Build the full Airtel API headers object.
 * @param {string} token - Bearer token
 */
export const getAirtelHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'X-Country': 'UG',
  'X-Currency': 'UGX',
  'Content-Type': 'application/json',
});
