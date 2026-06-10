/**
 * Phase 2 revenue-integrity regression tests for AdController.
 *
 * Locks:
 *  - An impression with an eventId logs a deduped event row + counts in one transaction;
 *    attribution (userId) comes from the verified token, NOT the request body.
 *  - A duplicate eventId (client retry) is idempotent — the counter is NOT incremented again.
 *  - Daily-budget cap is enforced (429 when the day's spend + cost exceeds the limit).
 *  - The public feed query is filtered to the active/approved/in-window set.
 */
import { test, expect, mock, beforeEach } from 'bun:test';

const txMock = {
  adImpression: { create: mock(async () => ({})) },
  adClick: { create: mock(async () => ({})) },
  ad: { updateMany: mock(async () => ({ count: 1 })) },
};
const prismaMock = {
  ad: {
    findUnique: mock(async () => null),
    findMany: mock(async () => []),
    count: mock(async () => 0),
    updateMany: mock(async () => ({ count: 1 })),
  },
  adImpression: { create: mock(async () => ({})) },
  adClick: { create: mock(async () => ({})) },
  $transaction: mock(async (fn) => fn(txMock)),
};

mock.module('../lib/prisma.mjs', () => ({ default: prismaMock }));
mock.module('../lib/r2.mjs', () => ({
  getSignedDownloadUrl: async () => 'https://signed',
  URL_EXPIRY: { DOWNLOAD_URL_EXPIRY: 86400 },
}));
mock.module('../lib/memoryCache.mjs', () => ({
  getStore: () => ({ get: () => null, set: () => {} }),
  mediaCacheMaxMs: () => 300000,
}));

const { trackAdImpression, getAllAds } = await import('../controllers/AdController.mjs');

function makeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const servableCpmAd = {
  id: 'ad-1', pricingModel: 'cpm', bidAmount: 1000, totalBudget: 100, amountSpent: 0,
  dailyBudgetLimit: null, dailySpend: 0, dailySpendDate: null, isActive: true, status: 'approved',
};

beforeEach(() => {
  prismaMock.ad.findUnique = mock(async () => ({ ...servableCpmAd }));
  prismaMock.ad.findMany = mock(async () => []);
  prismaMock.ad.count = mock(async () => 0);
  prismaMock.$transaction = mock(async (fn) => fn(txMock));
  txMock.adImpression.create = mock(async () => ({}));
  txMock.ad.updateMany = mock(async () => ({ count: 1 }));
});

test('a first impression logs a deduped event row + counts, attributed to the TOKEN user', async () => {
  let captured;
  txMock.adImpression.create = mock(async (args) => { captured = args; return {}; });

  const res = makeRes();
  await trackAdImpression(
    {
      params: { adId: 'ad-1' },
      body: { eventId: 'evt-1', wasVisible: true, viewportPercentage: 75, userId: 'SPOOFED', placement: 'question' },
      user: { id: 'real-user' },
      headers: { 'user-agent': 'jest' },
      ip: '1.2.3.4',
    },
    res, () => {},
  );

  expect(res.body.success).toBe(true);
  expect(captured.data.eventId).toBe('evt-1');
  expect(captured.data.userId).toBe('real-user'); // from token, not body.userId === 'SPOOFED'
  expect(captured.data.viewable).toBe(true);
  expect(captured.data.viewportPercentage).toBe(75);
  expect(captured.data.placement).toBe('question');
});

test('a duplicate eventId is idempotent — counter is NOT incremented again', async () => {
  txMock.adImpression.create = mock(async () => { const e = new Error('dup'); e.code = 'P2002'; throw e; });
  const updateManySpy = mock(async () => ({ count: 1 }));
  txMock.ad.updateMany = updateManySpy;

  const res = makeRes();
  await trackAdImpression(
    { params: { adId: 'ad-1' }, body: { eventId: 'evt-dup' }, user: {}, headers: {}, ip: '1.2.3.4' },
    res, () => {},
  );

  expect(res.body.success).toBe(true);
  expect(res.body.duplicate).toBe(true);
  expect(updateManySpy).not.toHaveBeenCalled();
});

test('daily budget cap returns 429 when the day spend + cost exceeds the limit', async () => {
  prismaMock.ad.findUnique = mock(async () => ({
    ...servableCpmAd, dailyBudgetLimit: 0.5, dailySpend: 0.5, dailySpendDate: new Date(),
  })); // CPM cost = 1; 0.5 + 1 > 0.5

  const res = makeRes();
  await trackAdImpression(
    { params: { adId: 'ad-1' }, body: { eventId: 'e' }, user: {}, headers: {}, ip: '' },
    res, () => {},
  );

  expect(res.statusCode).toBe(429);
  expect(res.body.message).toBe('Daily budget reached');
});

test('getAllAds filters to active + approved + in-window', async () => {
  let whereCaptured;
  prismaMock.ad.findMany = mock(async (args) => { whereCaptured = args.where; return []; });

  const res = makeRes();
  await getAllAds({ query: {} }, res, () => {});

  expect(whereCaptured.isActive).toBe(true);
  expect(whereCaptured.status).toBe('approved');
  // start/end window conditions
  expect(Array.isArray(whereCaptured.AND)).toBe(true);
});
