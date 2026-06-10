/**
 * Phase 1 security regression tests for AdController.
 *
 * Locks the invariants that stop the budget-drain + tamper holes:
 *  - Tracking spends budget ATOMICALLY and only for a servable ad: the updateMany WHERE
 *    carries the budget ceiling (amountSpent <= totalBudget - cost) and the
 *    active/approved/in-window conditions, so concurrent requests can't overspend and
 *    paused/expired/unapproved ads aren't charged.
 *  - Budget-exhausted → auto-pause; not-servable → 409.
 *  - updateAd / deleteAd require ownership (or admin/moderator), and updateAd whitelists
 *    campaign fields so an owner can't self-approve or reset their spend.
 *
 * Prisma + R2 + cache are stubbed via bun's mock.module BEFORE importing the controller.
 */
import { test, expect, mock, beforeEach } from 'bun:test';

const prismaMock = {
  ad: {
    findUnique: mock(async () => null),
    update: mock(async (args) => ({ id: 'ad-1', ...args.data })),
    updateMany: mock(async () => ({ count: 1 })),
    delete: mock(async () => ({})),
  },
  appUser: {
    findUnique: mock(async () => ({ role: 'USER' })),
  },
};

// Only prisma is mocked. We deliberately do NOT mock ../lib/r2.mjs or ../lib/memoryCache.mjs:
// bun's mock.module is process-global, so a PARTIAL mock would drop their other exports
// (STORAGE_PATHS, TTLCache) for unrelated test files in the same run. These tests never
// sign URLs, so the real modules load fine.
mock.module('../lib/prisma.mjs', () => ({ default: prismaMock }));

const { trackAdImpression, updateAd, deleteAd } = await import('../controllers/AdController.mjs');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const servableCpmAd = {
  id: 'ad-1', userId: 'owner', pricingModel: 'cpm', bidAmount: 1000,
  totalBudget: 100, amountSpent: 0, isActive: true, status: 'approved',
};

beforeEach(() => {
  prismaMock.ad.findUnique = mock(async () => null);
  prismaMock.ad.updateMany = mock(async () => ({ count: 1 }));
  prismaMock.ad.update = mock(async (args) => ({ id: 'ad-1', ...args.data }));
  prismaMock.appUser.findUnique = mock(async () => ({ role: 'USER' }));
});

test('trackAdImpression charges atomically with a budget ceiling + servable guard', async () => {
  prismaMock.ad.findUnique = mock(async () => ({ ...servableCpmAd }));
  let captured;
  prismaMock.ad.updateMany = mock(async (args) => { captured = args; return { count: 1 }; });

  const res = makeRes();
  await trackAdImpression({ params: { adId: 'ad-1' }, body: {} }, res, () => {});

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  // CPM cost = bidAmount/1000 = 1; ceiling = totalBudget - cost = 99.
  expect(captured.where.id).toBe('ad-1');
  expect(captured.where.isActive).toBe(true);
  expect(captured.where.status).toBe('approved');
  expect(captured.where.amountSpent).toEqual({ lte: 99 });
  // in-window conditions present
  expect(Array.isArray(captured.where.AND)).toBe(true);
  // increments the counter + spend in the SAME statement
  expect(captured.data.impressions).toEqual({ increment: 1 });
  expect(captured.data.amountSpent).toEqual({ increment: 1 });
});

test('trackAdImpression auto-pauses when the budget is exhausted', async () => {
  prismaMock.ad.findUnique = mock(async () => ({ ...servableCpmAd, amountSpent: 100 }));
  prismaMock.ad.updateMany = mock(async () => ({ count: 0 })); // guard rejected the spend
  let pauseArgs;
  // second updateMany call (the pause) — same mock; capture the pause write
  prismaMock.ad.updateMany = mock(async (args) => {
    if (args.data?.status === 'completed') { pauseArgs = args; return { count: 1 }; }
    return { count: 0 };
  });

  const res = makeRes();
  await trackAdImpression({ params: { adId: 'ad-1' }, body: {} }, res, () => {});

  expect(res.body.success).toBe(false);
  expect(res.body.message).toBe('Budget exhausted');
  expect(pauseArgs.data).toMatchObject({ status: 'completed', isActive: false });
});

test('trackAdImpression returns 409 when the ad is not servable (and does not overspend)', async () => {
  // Under budget, but the atomic guard rejected (e.g. paused/expired) → count 0, not over budget.
  prismaMock.ad.findUnique = mock(async () => ({ ...servableCpmAd, amountSpent: 0 }));
  prismaMock.ad.updateMany = mock(async () => ({ count: 0 }));

  const res = makeRes();
  await trackAdImpression({ params: { adId: 'ad-1' }, body: {} }, res, () => {});

  expect(res.statusCode).toBe(409);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toBe('Ad not servable');
});

test('trackAdImpression 404s for a missing ad', async () => {
  prismaMock.ad.findUnique = mock(async () => null);
  const res = makeRes();
  await trackAdImpression({ params: { adId: 'missing' }, body: {} }, res, () => {});
  expect(res.statusCode).toBe(404);
});

test('updateAd rejects a non-owner with 403', async () => {
  prismaMock.ad.findUnique = mock(async () => ({ id: 'ad-1', userId: 'owner' }));
  prismaMock.appUser.findUnique = mock(async () => ({ role: 'USER' }));

  const res = makeRes();
  await updateAd(
    { params: { adId: 'ad-1' }, body: { title: 'hijack' }, user: { id: 'attacker' } },
    res, () => {},
  );

  expect(res.statusCode).toBe(403);
  expect(prismaMock.ad.update).not.toHaveBeenCalled();
});

test('updateAd whitelists fields — owner cannot self-approve or reset spend', async () => {
  prismaMock.ad.findUnique = mock(async () => ({ id: 'ad-1', userId: 'owner' }));
  let captured;
  prismaMock.ad.update = mock(async (args) => { captured = args; return { id: 'ad-1' }; });

  const res = makeRes();
  await updateAd(
    {
      params: { adId: 'ad-1' },
      body: { title: 'New title', status: 'approved', amountSpent: 0, isActive: true, clicks: 9999 },
      user: { id: 'owner' },
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(captured.data.title).toBe('New title');
  expect(captured.data.status).toBeUndefined();
  expect(captured.data.amountSpent).toBeUndefined();
  expect(captured.data.isActive).toBeUndefined();
  expect(captured.data.clicks).toBeUndefined();
});

test('deleteAd rejects a non-owner with 403', async () => {
  prismaMock.ad.findUnique = mock(async () => ({ id: 'ad-1', userId: 'owner' }));
  prismaMock.appUser.findUnique = mock(async () => ({ role: 'USER' }));

  const res = makeRes();
  await deleteAd({ params: { adId: 'ad-1' }, user: { id: 'attacker' } }, res, () => {});

  expect(res.statusCode).toBe(403);
  expect(prismaMock.ad.delete).not.toHaveBeenCalled();
});

test('admin/moderator may update an ad they do not own', async () => {
  prismaMock.ad.findUnique = mock(async () => ({ id: 'ad-1', userId: 'owner' }));
  prismaMock.appUser.findUnique = mock(async () => ({ role: 'MODERATOR' }));
  prismaMock.ad.update = mock(async (args) => ({ id: 'ad-1', ...args.data }));

  const res = makeRes();
  await updateAd(
    { params: { adId: 'ad-1' }, body: { title: 'moderated' }, user: { id: 'mod' } },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
});
