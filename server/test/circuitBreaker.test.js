/**
 * Unit tests for the circuit breaker's L1 (in-memory) behaviour and fail-open
 * guarantee. With Upstash Redis unconfigured (the default in tests) the L2 layer
 * is skipped entirely, so these assert that behaviour is identical to before the
 * Redis integration — i.e. a payment is never blocked because Redis is absent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { getBreaker, resetBreaker } from '../lib/circuitBreaker.mjs';

const networkError = () => Promise.reject(new Error('network down'));
const clientError = () =>
  Promise.reject(Object.assign(new Error('bad request'), { response: { status: 400 } }));

test('successful calls pass through and keep the breaker CLOSED', async () => {
  const b = getBreaker('test-ok');
  resetBreaker('test-ok');
  const result = await b.exec(() => Promise.resolve(42));
  assert.equal(result, 42);
  assert.equal(b.getStatus().state, 'CLOSED');
});

test('breaker OPENS after the failure threshold and then short-circuits', async () => {
  const b = getBreaker('test-trip');
  resetBreaker('test-trip');
  const threshold = b.getStatus().failureThreshold;

  for (let i = 0; i < threshold; i++) {
    await assert.rejects(b.exec(networkError));
  }
  // Once open, the next call is short-circuited with a circuitOpen error
  // WITHOUT invoking the underlying function.
  let invoked = false;
  await assert.rejects(
    b.exec(() => { invoked = true; return Promise.resolve('should not run'); }),
    (err) => err.circuitOpen === true,
  );
  assert.equal(invoked, false, 'open breaker must not call the wrapped fn');
  assert.equal(b.getStatus().state, 'OPEN');
});

test('4xx client errors do NOT trip the breaker', async () => {
  const b = getBreaker('test-4xx');
  resetBreaker('test-4xx');
  const threshold = b.getStatus().failureThreshold;

  for (let i = 0; i < threshold + 2; i++) {
    await assert.rejects(b.exec(clientError));
  }
  assert.equal(b.getStatus().state, 'CLOSED', '4xx must never open the breaker');
});

test('resetBreaker returns an OPEN breaker to CLOSED', async () => {
  const b = getBreaker('test-reset');
  resetBreaker('test-reset');
  const threshold = b.getStatus().failureThreshold;
  for (let i = 0; i < threshold; i++) {
    await assert.rejects(b.exec(networkError));
  }
  assert.equal(b.getStatus().state, 'OPEN');
  resetBreaker('test-reset');
  assert.equal(b.getStatus().state, 'CLOSED');
});
