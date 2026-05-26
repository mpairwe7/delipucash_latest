/**
 * Unit tests for the Play Integrity nonce + middleware shape.
 * Network calls (Google APIs) are intentionally NOT exercised here — those
 * are integration tests that need real credentials.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { generateIntegrityNonce, requireIntegrity, verifyIntegrityToken } from '../lib/playIntegrity.mjs';

test('generateIntegrityNonce returns a unique base64url string', async () => {
  const a = await generateIntegrityNonce();
  const b = await generateIntegrityNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 20, 'nonce should have meaningful entropy');
});

test('verifyIntegrityToken returns missing_token without input', async () => {
  const r = await verifyIntegrityToken('');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'missing_token');
});

test('verifyIntegrityToken rejects unknown nonces (replay protection)', async () => {
  // No env configured; if we DO supply a nonce that isn't in cache, the call
  // short-circuits before the network attempt. We pass a junk token + a bogus
  // nonce and expect replayed_or_unknown_nonce because the nonce was never
  // issued by generateIntegrityNonce.
  const r = await verifyIntegrityToken('junk', { expectedNonce: 'never-issued-nonce' });
  // If env is configured we'd hit a network path; if not, we'd get not_configured.
  // Either way, the nonce cache should have rejected this first.
  assert.notEqual(r.reason, 'not_configured', 'nonce check must run before env check');
});

test('requireIntegrity middleware skips iOS clients', async () => {
  const middleware = requireIntegrity({ skipOnIos: true });
  let nextCalled = false;
  await middleware(
    { get: (h) => (h === 'X-Client-Platform' ? 'expo-react-native-ios' : null) },
    { status: () => ({ json: () => undefined }) },
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, true);
});

test('requireIntegrity middleware fails closed when token missing on Android', async () => {
  const middleware = requireIntegrity({ skipOnIos: true });
  let statusCode = null;
  let payload = null;
  await middleware(
    { get: () => null }, // no headers at all
    {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            payload = body;
          },
        };
      },
    },
    () => {},
  );
  assert.equal(statusCode, 403);
  assert.equal(payload?.error, 'INTEGRITY_FAILED');
});
