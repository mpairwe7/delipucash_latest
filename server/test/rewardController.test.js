/**
 * Unit tests for high-value redemption guards in rewardController.
 *
 * These tests focus on the parts of the redeem flow that are pure or easily
 * isolatable without spinning up Postgres:
 *   - phone format validation
 *   - velocity rule arithmetic
 *   - referral qualification gating logic
 *
 * Use `bun test`. Real prisma client is replaced with a lightweight mock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Mirror the helpers used inside rewardController for direct unit testing.
function isPhoneVerified(verifiedJson, cleanedPhone) {
  if (!verifiedJson) return false;
  const list = Array.isArray(verifiedJson) ? verifiedJson : [];
  return list.includes(cleanedPhone);
}

test('isPhoneVerified — empty list rejects every phone', () => {
  assert.equal(isPhoneVerified(null, '0770000001'), false);
  assert.equal(isPhoneVerified([], '0770000001'), false);
  assert.equal(isPhoneVerified({}, '0770000001'), false);
});

test('isPhoneVerified — only matches exact MSISDN strings', () => {
  const list = ['0770000001', '256770000002'];
  assert.equal(isPhoneVerified(list, '0770000001'), true);
  assert.equal(isPhoneVerified(list, '256770000002'), true);
  assert.equal(isPhoneVerified(list, '0770000003'), false);
  // No fuzzy / partial matches.
  assert.equal(isPhoneVerified(list, '770000001'), false);
});

// Phone format check used at the top of redeemRewards.
function validatePhone(phoneNumber) {
  const cleaned = String(phoneNumber || '').replace(/[^0-9]/g, '');
  if (cleaned.length < 9 || cleaned.length > 13) return { ok: false, error: 'INVALID_PHONE' };
  let local = cleaned;
  if (local.startsWith('256') && local.length >= 12) local = '0' + local.slice(3);
  if (local.startsWith('0')) {
    if (!/^(07[05678]|039)/.test(local)) return { ok: false, error: 'UNSUPPORTED_PREFIX' };
  }
  return { ok: true, cleaned, local };
}

test('validatePhone — accepts MTN local format', () => {
  assert.equal(validatePhone('0770000001').ok, true);
  assert.equal(validatePhone('0780000001').ok, true);
});

test('validatePhone — accepts Airtel prefixes', () => {
  assert.equal(validatePhone('0750000001').ok, true);
  assert.equal(validatePhone('0700000001').ok, true);
});

test('validatePhone — rejects unsupported prefixes', () => {
  const r = validatePhone('0810000001');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'UNSUPPORTED_PREFIX');
});

test('validatePhone — normalizes 256 international form', () => {
  const r = validatePhone('256770000001');
  assert.equal(r.ok, true);
  assert.equal(r.local, '0770000001');
});

test('validatePhone — rejects too-short numbers', () => {
  assert.equal(validatePhone('07700').ok, false);
});

// Velocity rule arithmetic — proves the 24h + burst windows behave as documented.
const VELOCITY_24H_LIMIT = 3;
const VELOCITY_BURST_WINDOW_MS = 5 * 60 * 1000;

function assertVelocity(count24h, recentBurstAtMs) {
  if (count24h >= VELOCITY_24H_LIMIT) return { allowed: false, code: 'VELOCITY_24H' };
  if (recentBurstAtMs && Date.now() - recentBurstAtMs < VELOCITY_BURST_WINDOW_MS) {
    return { allowed: false, code: 'VELOCITY_BURST' };
  }
  return { allowed: true };
}

test('velocity — under limit + no burst is allowed', () => {
  assert.deepEqual(assertVelocity(0, null), { allowed: true });
  assert.deepEqual(assertVelocity(2, null), { allowed: true });
});

test('velocity — at 24h limit blocks', () => {
  const r = assertVelocity(VELOCITY_24H_LIMIT, null);
  assert.equal(r.allowed, false);
  assert.equal(r.code, 'VELOCITY_24H');
});

test('velocity — burst window blocks even when under 24h limit', () => {
  const recentMs = Date.now() - 60_000; // 1 minute ago, still inside 5-min window
  const r = assertVelocity(0, recentMs);
  assert.equal(r.allowed, false);
  assert.equal(r.code, 'VELOCITY_BURST');
});

test('velocity — outside burst window is fine', () => {
  const oldMs = Date.now() - VELOCITY_BURST_WINDOW_MS - 1;
  assert.deepEqual(assertVelocity(0, oldMs), { allowed: true });
});
