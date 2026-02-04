import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptimizedQuery, paginate } from '../lib/queryStrategies.mjs';

// Test buildOptimizedQuery without cache strategies
test('buildOptimizedQuery applies defaults and omits undefined', () => {
  const query = buildOptimizedQuery('Question');

  assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }], 'default orderBy applied');
  assert.equal(query.skip, 0, 'default skip is zero');
  assert.equal(query.take, 100, 'default take is capped at DEFAULT_LIMIT');
  assert.ok(!('cacheStrategy' in query), 'no cacheStrategy in query');
  assert.ok(!('where' in query), 'where omitted when undefined');
  assert.ok(!('select' in query), 'select omitted when undefined');
  assert.ok(!('include' in query), 'include omitted when undefined');
});

test('buildOptimizedQuery preserves empty orderBy arrays', () => {
  const query = buildOptimizedQuery('Question', { orderBy: [] });
  assert.deepEqual(query.orderBy, [], 'empty orderBy should not be replaced');
});

test('buildOptimizedQuery caps take and passes where/select/include', () => {
  const query = buildOptimizedQuery('Question', {
    where: { active: true },
    select: { id: true },
    include: { user: true },
    skip: 10,
    take: 500, // should cap to 100
  });

  assert.deepEqual(query.where, { active: true });
  assert.deepEqual(query.select, { id: true });
  assert.deepEqual(query.include, { user: true });
  assert.equal(query.skip, 10);
  assert.equal(query.take, 100, 'take should be capped to DEFAULT_LIMIT');
});

test('paginate returns skip/take respecting limits and page floor', () => {
  const page1 = paginate();
  assert.deepEqual(page1, { skip: 0, take: 100 });

  const page3 = paginate(3, 25);
  assert.deepEqual(page3, { skip: 50, take: 25 });

  const capped = paginate(2, 1000);
  assert.deepEqual(capped, { skip: 100, take: 100 }, 'pageSize caps at DEFAULT_LIMIT');
});
