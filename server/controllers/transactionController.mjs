import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set(['reward', 'withdrawal', 'deposit', 'payment']);
const VALID_STATUSES = new Set(['PENDING', 'SUCCESSFUL', 'FAILED']);

function mapPaymentMethod(provider) {
  if (provider === 'MTN') return 'mtn_mobile_money';
  if (provider === 'AIRTEL') return 'airtel_money';
  return provider?.toLowerCase() ?? null;
}

// ---------------------------------------------------------------------------
// Helpers — map each source table row to the unified transaction shape
// ---------------------------------------------------------------------------

function mapReward(r) {
  const label = r.description
    ? r.description.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Reward';

  return {
    id: `rwd_${r.id}`,
    type: 'reward',
    amount: r.points,
    status: 'SUCCESSFUL',
    description: label,
    referenceId: null,
    paymentMethod: null,
    phoneNumber: null,
    source: 'Reward',
    sourceId: r.id,
    createdAt: (r.createdAt ?? new Date()).toISOString(),
    _sortKey: r.createdAt?.getTime() ?? 0,
  };
}

function mapRedemption(r) {
  return {
    id: `rdm_${r.id}`,
    type: 'withdrawal',
    amount: -r.cashValue,
    status: r.status,
    description: `Withdrawal via ${r.provider}`,
    referenceId: r.transactionRef ?? null,
    paymentMethod: mapPaymentMethod(r.provider),
    phoneNumber: r.phoneNumber ?? null,
    source: 'RewardRedemption',
    sourceId: r.id,
    createdAt: (r.requestedAt ?? new Date()).toISOString(),
    _sortKey: r.requestedAt?.getTime() ?? 0,
  };
}

function mapPayment(p) {
  const feature = p.featureType === 'VIDEO' ? 'Video' : 'Survey';
  const sub = p.subscriptionType
    ? p.subscriptionType.charAt(0) + p.subscriptionType.slice(1).toLowerCase()
    : '';

  return {
    id: `pay_${p.id}`,
    type: 'payment',
    amount: -p.amount,
    status: p.status,
    description: `${feature} Premium${sub ? ` — ${sub}` : ''}`,
    referenceId: p.TransactionId ?? null,
    paymentMethod: mapPaymentMethod(p.provider),
    phoneNumber: p.phoneNumber ?? null,
    source: 'Payment',
    sourceId: p.id,
    createdAt: (p.createdAt ?? new Date()).toISOString(),
    _sortKey: p.createdAt?.getTime() ?? 0,
  };
}

function mapInstantWinner(w) {
  return {
    id: `irw_${w.id}`,
    type: 'deposit',
    amount: w.amountAwarded,
    status: w.paymentStatus,
    description: `Instant Reward Won — Position #${w.position}`,
    referenceId: w.paymentReference ?? null,
    paymentMethod: w.paymentProvider ? mapPaymentMethod(w.paymentProvider) : null,
    phoneNumber: w.phoneNumber ?? null,
    source: 'InstantRewardWinner',
    sourceId: w.id,
    createdAt: (w.createdAt ?? new Date()).toISOString(),
    _sortKey: w.createdAt?.getTime() ?? 0,
  };
}

/** Strip internal _sortKey before sending to client */
function stripSortKey({ _sortKey, ...rest }) {
  return rest;
}

// ---------------------------------------------------------------------------
// GET /api/transactions
// Unified, paginated, filterable transaction list
// ---------------------------------------------------------------------------

export const getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // CRITICAL FIX: JWT only has { id }, so lookup email from DB
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  const userEmail = user.email;

  // Parse & validate query params
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const typeFilter = VALID_TYPES.has(req.query.type) ? req.query.type : null;
  const statusFilter = VALID_STATUSES.has(req.query.status) ? req.query.status : null;

  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
  if ((startDate && isNaN(startDate.getTime())) || (endDate && isNaN(endDate.getTime()))) {
    return res.status(400).json({ success: false, error: 'Invalid date format.' });
  }

  // Build date filter helpers
  const dateWhere = {};
  if (startDate) dateWhere.gte = startDate;
  if (endDate) dateWhere.lte = endDate;
  const hasDateFilter = startDate || endDate;

  // Determine which tables to query based on type filter
  const shouldQueryRewards = !typeFilter || typeFilter === 'reward';
  const shouldQueryRedemptions = !typeFilter || typeFilter === 'withdrawal';
  const shouldQueryPayments = !typeFilter || typeFilter === 'payment';
  const shouldQueryWinners = !typeFilter || typeFilter === 'deposit';

  // For status filter: Reward rows are always SUCCESSFUL, skip if filtering for non-SUCCESSFUL
  const skipRewardsByStatus = statusFilter && statusFilter !== 'SUCCESSFUL';

  // Database-level pagination: fetch only enough rows from each table to cover
  // the current page position. For page 1/limit 20: 20 per table (80 max).
  // For page 3/limit 20: 60 per table (240 max). This is O(page*limit) per
  // table instead of O(total) — critical for users with large tx history.
  const fetchLimit = (page - 1) * limit + limit; // = page * limit

  // Run data queries + count queries in parallel
  // Count queries give us the true total across all tables
  const [rewards, redemptions, payments, winners, rewardCount, redemptionCount, paymentCount, winnerCount] =
    await Promise.all([
      // --- Data queries (bounded by fetchLimit per table) ---
      shouldQueryRewards && !skipRewardsByStatus
        ? prisma.reward.findMany({
            where: {
              userEmail,
              ...(hasDateFilter ? { createdAt: dateWhere } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
          })
        : [],

      shouldQueryRedemptions
        ? prisma.rewardRedemption.findMany({
            where: {
              userId,
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(hasDateFilter ? { requestedAt: dateWhere } : {}),
            },
            orderBy: { requestedAt: 'desc' },
            take: fetchLimit,
          })
        : [],

      shouldQueryPayments
        ? prisma.payment.findMany({
            where: {
              userId,
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(hasDateFilter ? { createdAt: dateWhere } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
          })
        : [],

      shouldQueryWinners
        ? prisma.instantRewardWinner.findMany({
            where: {
              userEmail,
              ...(statusFilter ? { paymentStatus: statusFilter } : {}),
              ...(hasDateFilter ? { createdAt: dateWhere } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
          })
        : [],

      // --- Count queries for true total ---
      shouldQueryRewards && !skipRewardsByStatus
        ? prisma.reward.count({
            where: {
              userEmail,
              ...(hasDateFilter ? { createdAt: dateWhere } : {}),
            },
          })
        : 0,

      shouldQueryRedemptions
        ? prisma.rewardRedemption.count({
            where: {
              userId,
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(hasDateFilter ? { requestedAt: dateWhere } : {}),
            },
          })
        : 0,

      shouldQueryPayments
        ? prisma.payment.count({
            where: {
              userId,
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(hasDateFilter ? { createdAt: dateWhere } : {}),
            },
          })
        : 0,

      shouldQueryWinners
        ? prisma.instantRewardWinner.count({
            where: {
              userEmail,
              ...(statusFilter ? { paymentStatus: statusFilter } : {}),
              ...(hasDateFilter ? { createdAt: dateWhere } : {}),
            },
          })
        : 0,
    ]);

  // True total across all tables
  const total = rewardCount + redemptionCount + paymentCount + winnerCount;

  // Map to unified shape and sort by _sortKey (epoch ms) for performance
  const unified = [
    ...rewards.map(mapReward),
    ...redemptions.map(mapRedemption),
    ...payments.map(mapPayment),
    ...winners.map(mapInstantWinner),
  ];
  unified.sort((a, b) => b._sortKey - a._sortKey);

  // Apply offset pagination
  const skip = (page - 1) * limit;
  const paged = unified.slice(skip, skip + limit).map(stripSortKey);
  const totalPages = Math.ceil(total / limit);

  // Compute lightweight summary (only on first page)
  let summary = null;
  if (page === 1) {
    summary = await computeSummary(userId, userEmail);
  }

  res.json({
    success: true,
    data: {
      transactions: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      ...(summary ? { summary } : {}),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/transactions/summary
// Lightweight wallet summary (no transaction list)
// ---------------------------------------------------------------------------

export const getTransactionSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Lookup email from DB (JWT only has id)
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const summary = await computeSummary(userId, user.email);

  res.json({ success: true, data: summary });
});

// ---------------------------------------------------------------------------
// Shared summary computation
// ---------------------------------------------------------------------------

async function computeSummary(userId, userEmail) {
  const [rewardSum, winnerSum, redemptionSum, pendingRedemptionSum, user] =
    await Promise.all([
      prisma.reward.aggregate({
        where: { userEmail },
        _sum: { points: true },
      }),
      prisma.instantRewardWinner.aggregate({
        where: { userEmail, paymentStatus: 'SUCCESSFUL' },
        _sum: { amountAwarded: true },
      }),
      prisma.rewardRedemption.aggregate({
        where: { userId, status: 'SUCCESSFUL' },
        _sum: { cashValue: true },
      }),
      prisma.rewardRedemption.aggregate({
        where: { userId, status: 'PENDING' },
        _sum: { cashValue: true },
      }),
      prisma.appUser.findUnique({
        where: { id: userId },
        select: { points: true },
      }),
    ]);

  return {
    totalEarned: rewardSum._sum.points ?? 0,
    totalCashWon: winnerSum._sum.amountAwarded ?? 0,
    totalWithdrawn: redemptionSum._sum.cashValue ?? 0,
    pendingWithdrawals: pendingRedemptionSum._sum.cashValue ?? 0,
    currentBalance: user?.points ?? 0,
  };
}
