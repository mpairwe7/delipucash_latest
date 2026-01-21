import cacheStrategies, { modelCacheRecommendations } from './cacheStrategies.mjs';

// Upper bound to prevent unbounded queries while keeping UX responsive
const DEFAULT_LIMIT = 100;

/**
 * Build a query with safe defaults, pagination, and model-specific cache strategy.
 * Use alongside Prisma Accelerate to keep queries lean and cache-friendly.
 */
export function buildOptimizedQuery(modelName, options = {}) {
  const {
    where,
    orderBy,
    select,
    include,
    skip,
    take,
    cacheStrategy,
  } = options;

  const safeTake = Math.min(take ?? DEFAULT_LIMIT, DEFAULT_LIMIT);

  return {
    where,
    orderBy: orderBy || [{ createdAt: 'desc' }],
    select,
    include,
    skip: skip ?? 0,
    take: safeTake,
    cacheStrategy: cacheStrategy ?? modelCacheRecommendations[modelName] ?? cacheStrategies.shortLived,
  };
}

/**
 * Simple paginator helper to pair with buildOptimizedQuery.
 */
export function paginate(page = 1, pageSize = DEFAULT_LIMIT) {
  const safePageSize = Math.min(pageSize, DEFAULT_LIMIT);
  const safePage = Math.max(page, 1);

  return {
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  };
}

export default {
  buildOptimizedQuery,
  paginate,
};
