/**
 * Unit tests for the in-process TTL + approximate-LRU cache.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TTLCache, getStore, cached } from '../lib/memoryCache.mjs';

test('TTLCache stores and retrieves a value before expiry', () => {
  const c = new TTLCache(10);
  c.set('k', { v: 1 }, 1000);
  assert.deepEqual(c.get('k'), { v: 1 });
});

test('TTLCache expires entries after their TTL', async () => {
  const c = new TTLCache(10);
  c.set('k', 1, 20);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(c.get('k'), undefined);
});

test('TTLCache evicts the oldest entry beyond the cap', () => {
  const c = new TTLCache(2);
  c.set('a', 1, 1000);
  c.set('b', 2, 1000);
  c.set('c', 3, 1000); // over cap → evict oldest ('a')
  assert.equal(c.get('a'), undefined);
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('c'), 3);
});

test('TTLCache deleteByPrefix removes only matching keys', () => {
  const c = new TTLCache(10);
  c.set('videos:all:1', 1, 1000);
  c.set('videos:all:2', 2, 1000);
  c.set('ads:1', 3, 1000);
  const n = c.deleteByPrefix('videos:');
  assert.equal(n, 2);
  assert.equal(c.get('videos:all:1'), undefined);
  assert.equal(c.get('ads:1'), 3);
});

test('cached() runs the producer once, then serves from cache', async () => {
  const store = getStore('test-cached', 10);
  let calls = 0;
  const producer = async () => { calls++; return { n: calls }; };
  const a = await cached(store, 'key', 1000, producer);
  const b = await cached(store, 'key', 1000, producer);
  assert.deepEqual(a, { n: 1 });
  assert.deepEqual(b, { n: 1 }); // second call hits cache
  assert.equal(calls, 1);
});

test('cached() does not cache null/undefined producer results', async () => {
  const store = getStore('test-cached-null', 10);
  let calls = 0;
  const producer = async () => { calls++; return null; };
  await cached(store, 'k', 1000, producer);
  await cached(store, 'k', 1000, producer);
  assert.equal(calls, 2); // null is not cached → producer runs each time
});
