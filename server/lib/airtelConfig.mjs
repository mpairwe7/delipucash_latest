/**
 * Airtel Money — Centralized Configuration
 *
 * Provides:
 *  - Environment-driven base URL (sandbox vs production)
 *  - OAuth token caching (30s safety margin)
 *  - Phone number formatter (E164_NO_PLUS or LOCAL)
 *  - Header builder
 *  - Status classification (handles Airtel's inconsistent response schemas)
 *  - Reusable polling helper
 *
 * @module lib/airtelConfig
 */

import axios from 'axios';
import { isSandbox, tokenCache, EXPIRY_BUFFER_MS } from './mtnConfig.mjs';
import { createPaymentLogger } from './paymentLogger.mjs';
import { getBreaker } from './circuitBreaker.mjs';

const log = createPaymentLogger('airtel');
const breaker = getBreaker('airtel');

// ---------------------------------------------------------------------------
// Environment-derived constants
// ---------------------------------------------------------------------------

export const AIRTEL_BASE_URL = process.env.AIRTEL_BASE_URL ||
  (isSandbox
    ? 'https://openapiuat.airtel.africa'
    : 'https://openapi.airtel.africa');

export const AIRTEL_COUNTRY = process.env.AIRTEL_COUNTRY || 'UG';
export const AIRTEL_CURRENCY = process.env.AIRTEL_CURRENCY || 'UGX';
// E164_NO_PLUS => 2567XXXXXXXX, LOCAL => 7XXXXXXXX
export const AIRTEL_MSISDN_FORMAT = process.env.AIRTEL_MSISDN_FORMAT || 'E164_NO_PLUS';

// ---------------------------------------------------------------------------
// Environment validation (runs once at import time)
// ---------------------------------------------------------------------------

const validateAirtelEnv = () => {
  const missing = [];
  ['AIRTEL_CLIENT_ID', 'AIRTEL_CLIENT_SECRET'].forEach(v => {
    if (!process.env[v]) missing.push(v);
  });
  if (missing.length > 0) {
    log.warn('Missing env vars — Airtel payments will fail', { missing });
  }
};

validateAirtelEnv();

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/** @type {Record<string, Promise<string>>} */
const inflightRequests = {};

/**
 * Get an OAuth token for the Airtel API.
 * Cached with the same safety margin as MTN tokens.
 * Concurrent requests coalesce into a single API call.
 */
export const getAirtelToken = async () => {
  const cacheKey = 'airtel';
  const cached = tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  // Coalesce concurrent refresh requests (thundering herd guard)
  if (inflightRequests[cacheKey]) {
    return inflightRequests[cacheKey];
  }

  const fetchToken = async () => {
    try {
      const response = await breaker.exec(() =>
        axios.post(
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
            timeout: 15_000,
          }
        )
      );

      const payload = response.data?.data || response.data || {};
      const accessToken = payload.access_token || payload.accessToken || payload.token;
      const expiresIn = Number(payload.expires_in || payload.expiresIn || 3600);

      if (!accessToken) {
        throw new Error('Airtel token response missing access token');
      }

      const ttl = expiresIn * 1000;
      // Clamp: if TTL < buffer, cache for at least 30s to avoid token thrashing
      const MIN_CACHE_MS = 30_000;
      const expiresAt = Date.now() + Math.max(ttl - EXPIRY_BUFFER_MS, MIN_CACHE_MS);

      tokenCache[cacheKey] = { token: accessToken, expiresAt };
      log.info('Fresh Airtel token acquired', { expiresIn });
      return accessToken;
    } catch (error) {
      if (error.circuitOpen) {
        log.warn('Circuit open — skipping token request', { retryAfterMs: error.retryAfterMs });
        throw error;
      }
      log.error('Airtel token error', {
        status: error.response?.status,
        message: error.message,
      });
      throw new Error(`Airtel API Error: ${error.response?.data?.message || error.message}`);
    }
  };

  inflightRequests[cacheKey] = fetchToken().finally(() => {
    delete inflightRequests[cacheKey];
  });

  return inflightRequests[cacheKey];
};

// ---------------------------------------------------------------------------
// Phone number formatter
// ---------------------------------------------------------------------------

/**
 * Normalize Airtel MSISDN based on `AIRTEL_MSISDN_FORMAT`.
 * - E164_NO_PLUS (default): 2567XXXXXXXX
 * - LOCAL: 7XXXXXXXX
 * @throws {Error} if the phone number cannot be normalized to a valid format
 */
export const formatAirtelPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('Invalid Airtel phone number: empty input');
  }

  let formatted;

  if (AIRTEL_MSISDN_FORMAT === 'LOCAL') {
    if (digits.startsWith('256') && digits.length === 12) formatted = digits.substring(3);
    else if (digits.startsWith('0') && digits.length === 10) formatted = digits.substring(1);
    else formatted = digits;

    // LOCAL format: must be 9 digits starting with 7
    if (!/^7\d{8}$/.test(formatted)) {
      throw new Error(`Invalid Airtel phone number (LOCAL): expected 7XXXXXXXX, got ${formatted.substring(0, 4)}...`);
    }
  } else {
    // Default: E164 without "+"
    if (digits.startsWith('256') && digits.length === 12) formatted = digits;
    else if (digits.startsWith('0') && digits.length === 10) formatted = `256${digits.substring(1)}`;
    else if (/^7\d{8}$/.test(digits)) formatted = `256${digits}`;
    else formatted = digits;

    // E164_NO_PLUS format: must be 12 digits starting with 256
    if (!/^256\d{9}$/.test(formatted)) {
      throw new Error(`Invalid Airtel phone number (E164): expected 2567XXXXXXXX, got ${formatted.substring(0, 6)}...`);
    }
  }

  return formatted;
};

// ---------------------------------------------------------------------------
// Header builder
// ---------------------------------------------------------------------------

/**
 * Build the full Airtel API headers object.
 * @param {string} token - Bearer token
 */
export const getAirtelHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'X-Country': AIRTEL_COUNTRY,
  'X-Currency': AIRTEL_CURRENCY,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------

const toUpper = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : null);

const AIRTEL_SUCCESS_TRANSACTION_STATUSES = new Set(['SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'TS']);
const AIRTEL_PENDING_TRANSACTION_STATUSES = new Set(['PENDING', 'PROCESSING', 'IN_PROGRESS', 'INPROGRESS', 'INITIATED']);
const AIRTEL_FAILURE_TRANSACTION_STATUSES = new Set(['FAILED', 'FAILURE', 'REJECTED', 'CANCELLED', 'ERROR', 'TIMEOUT']);
const AIRTEL_SUCCESS_RESPONSE_CODES = new Set(['DP00800001001']);
const AIRTEL_PENDING_RESPONSE_CODES = new Set(['200', '201', '202', 'DP00800001000']);
const AIRTEL_FAILURE_RESPONSE_CODES = new Set(['400', '401', '403', '404', '409', '422', '500']);

/**
 * Extract status fields from Airtel's inconsistent response schemas.
 * Checks multiple possible payload locations for status, response code,
 * and transaction ID.
 */
export const extractAirtelStatusFields = (payload = {}) => {
  const statusObject = payload?.status && typeof payload.status === 'object' ? payload.status : {};
  const dataStatus = payload?.data?.status;

  let rawTxStatus = payload?.data?.transaction?.status ?? payload?.transaction?.status;
  if (!rawTxStatus && typeof dataStatus === 'string') rawTxStatus = dataStatus;
  if (!rawTxStatus && typeof payload?.status === 'string') rawTxStatus = payload.status;

  return {
    responseCode: toUpper(
      statusObject.response_code ||
      statusObject.responseCode ||
      statusObject.result_code ||
      statusObject.code ||
      payload?.response_code ||
      payload?.responseCode
    ),
    responseSuccess: typeof statusObject.success === 'boolean' ? statusObject.success : undefined,
    transactionStatus: toUpper(rawTxStatus),
    transactionId:
      payload?.data?.transaction?.id ||
      payload?.transaction?.id ||
      payload?.data?.id ||
      payload?.id ||
      null,
  };
};

/**
 * Classify an Airtel API response payload into a normalized state.
 * @returns {{ state: 'SUCCESSFUL'|'FAILED'|'PENDING', meta: object }}
 */
export const classifyAirtelStatus = (payload = {}) => {
  const meta = extractAirtelStatusFields(payload);
  const { responseCode, responseSuccess, transactionStatus } = meta;

  if (responseSuccess === false) return { state: 'FAILED', meta };
  if (AIRTEL_FAILURE_TRANSACTION_STATUSES.has(transactionStatus)) return { state: 'FAILED', meta };
  if (AIRTEL_SUCCESS_TRANSACTION_STATUSES.has(transactionStatus)) return { state: 'SUCCESSFUL', meta };
  if (AIRTEL_FAILURE_RESPONSE_CODES.has(responseCode)) return { state: 'FAILED', meta };
  if (AIRTEL_SUCCESS_RESPONSE_CODES.has(responseCode)) return { state: 'SUCCESSFUL', meta };
  if (AIRTEL_PENDING_TRANSACTION_STATUSES.has(transactionStatus)) return { state: 'PENDING', meta };
  if (AIRTEL_PENDING_RESPONSE_CODES.has(responseCode)) return { state: 'PENDING', meta };

  return { state: 'PENDING', meta };
};

// ---------------------------------------------------------------------------
// Polling helper
// ---------------------------------------------------------------------------

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll Airtel status endpoint until a terminal state is reached.
 *
 * @param {object} opts
 * @param {string} opts.token - Bearer token
 * @param {string} opts.referenceId - Transaction reference
 * @param {'collection'|'disbursement'} [opts.operationType='collection']
 * @param {number} [opts.maxAttempts=12]
 * @param {number} [opts.delayMs=3000]
 * @param {boolean} [opts.backoff=true] - Use exponential backoff (3s * 1.3^n, capped at 15s)
 * @returns {Promise<{ state: string, meta: object }>}
 */
export const pollAirtelStatus = async ({
  token,
  referenceId,
  operationType = 'collection',
  maxAttempts = 12,
  delayMs = 3000,
  backoff = true,
}) => {
  const endpoint = operationType === 'disbursement'
    ? `${AIRTEL_BASE_URL}/standard/v1/disbursements/${referenceId}`
    : `${AIRTEL_BASE_URL}/standard/v1/payments/${referenceId}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(endpoint, { headers: getAirtelHeaders(token), timeout: 30_000 });
      const parsed = classifyAirtelStatus(response.data);

      log.info(`${operationType} poll attempt ${attempt}/${maxAttempts}`, {
        state: parsed.state,
        responseCode: parsed.meta.responseCode,
        transactionStatus: parsed.meta.transactionStatus,
      });

      if (parsed.state === 'SUCCESSFUL' || parsed.state === 'FAILED') {
        return parsed;
      }
    } catch (error) {
      log.error(`${operationType} poll attempt ${attempt} failed`, { message: error.message });
    }

    if (attempt < maxAttempts) {
      // Exponential backoff: 3s → 4s → 5s → 7s → 10s, capped at 15s
      const delay = backoff
        ? Math.min(delayMs * Math.pow(1.3, attempt - 1), 15000)
        : delayMs;
      await wait(delay);
    }
  }

  return { state: 'PENDING', meta: { transactionId: referenceId } };
};
