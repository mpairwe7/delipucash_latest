import cacheStrategies, { modelCacheRecommendations } from './cacheStrategies.mjs';

// Upper bound to prevent unbounded queries while keeping UX responsive
const DEFAULT_LIMIT = 100;

/**
 * Build a query with safe defaults, pagination, and model-specific cache strategy.
 * Use alongside Prisma Accelerate to keep queries lean and cache-friendly.
 *
 * @param {string} modelName - The Prisma/model name used as a key in `modelCacheRecommendations`
 *   to determine the default cache strategy when one is not explicitly provided.
 * @param {object} [options] - Query options such as `where`, `orderBy`, `select`, `include`,
 *   `skip`, `take`, and an optional `cacheStrategy` to override the model-based default.
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
  const query = {
    orderBy: orderBy ?? [{ createdAt: 'desc' }],
    skip: skip ?? 0,
    take: safeTake,
    cacheStrategy: cacheStrategy ?? modelCacheRecommendations[modelName] ?? cacheStrategies.shortLived,
  };

  if (where !== undefined) {
    query.where = where;
  }

  if (select !== undefined) {
    query.select = select;
  }

  if (include !== undefined) {
    query.include = include;
  }

  return query;
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
