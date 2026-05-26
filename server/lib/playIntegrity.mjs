/**
 * Google Play Integrity verification.
 *
 * Use to gate high-value endpoints (redemption, withdrawal). The mobile client
 * obtains an integrity verdict token via the Play Integrity API on Android,
 * sends it as the `X-Play-Integrity-Token` header, and the server verifies it
 * against `playintegrity.googleapis.com`.
 *
 * This blocks rooted/emulator/sideloaded installs from initiating cash payouts.
 *
 * On iOS the equivalent is App Attest (DeviceCheck) — out of scope for the
 * Play-Store-launch P0 phase. iOS clients send no header and are admitted for
 * now (we'll layer App Attest in P1).
 *
 * Configuration:
 *   PLAY_INTEGRITY_PACKAGE_NAME   — Android package, e.g. com.arolainc.DelipuCash
 *   GOOGLE_CLOUD_PROJECT_NUMBER   — numeric project number for the Cloud project
 *                                    that owns the Play Integrity API
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON — service-account JSON (preferred over
 *                                          a file path on Vercel)
 *
 * If env is missing, verification is SKIPPED with a warning so dev environments
 * keep working. In production we expect all three to be set.
 */

import crypto from 'crypto';
import { redisEnabled, rSetNX, rGetDel } from './redis.mjs';

const PACKAGE_NAME = process.env.PLAY_INTEGRITY_PACKAGE_NAME || 'com.arolainc.DelipuCash';
const PROJECT_NUMBER = process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '';
const CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';

// Nonce replay-protection. When Upstash Redis is configured it is AUTHORITATIVE
// (cluster-wide — fixes cross-instance issue/consume on serverless). The in-memory
// map below is the FAIL-OPEN fallback used only when Redis is unavailable: same
// per-instance behaviour as before Redis, never failing closed on a Redis outage.
const seenNonces = new Map(); // nonce → expiry epoch ms
const NONCE_TTL_MS = 5 * 60 * 1000;
const NONCE_TTL_SEC = Math.floor(NONCE_TTL_MS / 1000);

function purgeExpiredNonces() {
  const now = Date.now();
  for (const [nonce, expiry] of seenNonces.entries()) {
    if (expiry < now) seenNonces.delete(nonce);
  }
}

/**
 * Generate a fresh nonce the client must echo back inside the integrity request.
 * Async: when Redis is configured the nonce is registered there (awaited) before
 * returning, so it is visible to whichever instance handles the redeem call.
 */
export async function generateIntegrityNonce() {
  const nonce = crypto.randomBytes(24).toString('base64url');
  seenNonces.set(nonce, Date.now() + NONCE_TTL_MS); // local fallback
  if (redisEnabled) {
    await rSetNX(`nonce:${nonce}`, '1', NONCE_TTL_SEC);
  }
  return nonce;
}

/** One-time consume. Returns true if the nonce was valid and previously unused. */
async function consumeNonce(nonce) {
  if (!nonce) return false;

  if (redisEnabled) {
    const r = await rGetDel(`nonce:${nonce}`);
    if (r.ok) {
      // Authoritative: present → first use (valid); absent → replay/unknown.
      return Boolean(r.value);
    }
    // r.ok === false → Redis errored; fall back to the in-memory map below.
  }

  purgeExpiredNonces();
  const expiry = seenNonces.get(nonce);
  if (!expiry || expiry < Date.now()) return false;
  seenNonces.delete(nonce);
  return true;
}

let cachedAccessToken = { token: null, expiresAt: 0 };

/**
 * Mint a service-account access token via the OAuth2 token endpoint.
 * Cached for the token's reported lifetime minus a 5-min safety buffer.
 */
async function getAccessToken() {
  if (!CREDENTIALS_JSON) return null;
  if (cachedAccessToken.token && cachedAccessToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedAccessToken.token;
  }

  let creds;
  try {
    creds = JSON.parse(CREDENTIALS_JSON);
  } catch {
    console.warn('[playIntegrity] GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON');
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${enc(header)}.${enc(claims)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(creds.private_key).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    console.warn('[playIntegrity] Token mint failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedAccessToken.token;
}

/**
 * Decode + validate an integrity token via Google Play Integrity API.
 * Returns { ok: true, verdict } on success or { ok: false, reason } on failure.
 *
 * Skips verification when configuration is incomplete (dev environments) and
 * returns ok with reason='not_configured' so callers can decide whether to
 * still allow the request.
 */
export async function verifyIntegrityToken(token, { expectedNonce } = {}) {
  if (!token) return { ok: false, reason: 'missing_token' };

  // Block replays FIRST: a replayed/unknown nonce is rejected even when integrity
  // verification itself is not configured (defence in depth — the nonce must have
  // been issued by us within the TTL regardless of env).
  if (expectedNonce && !(await consumeNonce(expectedNonce))) {
    return { ok: false, reason: 'replayed_or_unknown_nonce' };
  }

  if (!PROJECT_NUMBER || !CREDENTIALS_JSON) {
    return { ok: true, reason: 'not_configured', skipped: true };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, reason: 'no_access_token' };

  const url = `https://playintegrity.googleapis.com/v1/${encodeURIComponent(PACKAGE_NAME)}:decodeIntegrityToken`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integrityToken: token }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn('[playIntegrity] decode failed:', res.status, body.slice(0, 200));
    return { ok: false, reason: 'decode_failed' };
  }
  const verdict = await res.json();
  const tokenPayload = verdict.tokenPayloadExternal || {};

  const appIntegrity = tokenPayload.appIntegrity?.appRecognitionVerdict;
  const deviceIntegrity = tokenPayload.deviceIntegrity?.deviceRecognitionVerdict || [];
  const requestPackageName = tokenPayload.requestDetails?.requestPackageName;

  if (requestPackageName && requestPackageName !== PACKAGE_NAME) {
    return { ok: false, reason: 'package_mismatch', verdict: tokenPayload };
  }
  if (appIntegrity !== 'PLAY_RECOGNIZED') {
    return { ok: false, reason: 'app_not_recognized', verdict: tokenPayload };
  }
  if (!deviceIntegrity.includes('MEETS_DEVICE_INTEGRITY')) {
    return { ok: false, reason: 'device_integrity_failed', verdict: tokenPayload };
  }
  return { ok: true, verdict: tokenPayload };
}

/**
 * Express middleware factory.
 * Use as `requireIntegrity()` in a route chain to enforce verification.
 *
 *   POST /api/rewards/redeem
 *     verifyToken → requireIntegrity() → redeemRewards
 */
export function requireIntegrity({ skipOnIos = true } = {}) {
  return async (req, res, next) => {
    const platform = (req.get('X-Client-Platform') || '').toLowerCase();
    if (skipOnIos && platform.includes('ios')) {
      return next(); // App Attest comes in a later phase
    }
    const token = req.get('X-Play-Integrity-Token');
    const nonce = req.get('X-Play-Integrity-Nonce');
    const result = await verifyIntegrityToken(token, { expectedNonce: nonce });
    if (!result.ok) {
      return res.status(403).json({
        success: false,
        error: 'INTEGRITY_FAILED',
        reason: result.reason,
        message: 'This action requires a verified Google Play install. Please open the app from the Play Store.',
      });
    }
    req.integrityVerdict = result.verdict;
    return next();
  };
}
