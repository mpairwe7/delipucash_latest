// Query strategies without caching
// Removed cache strategies for direct database queries

// Upper bound to prevent unbounded queries while keeping UX responsive
const DEFAULT_LIMIT = 100;

/**
 * Build a query with safe defaults and pagination.
 * Use for optimized Prisma queries without caching.
 *
 * @param {string} modelName - The Prisma/model name (for reference only)
 * @param {object} [options] - Query options such as `where`, `orderBy`, `select`, `include`,
 *   `skip`, `take`.
 */
export function buildOptimizedQuery(modelName, options = {}) {
  const {
    where,
    orderBy,
    select,
    include,
    skip,
    take,
  } = options;

  const safeTake = Math.min(take ?? DEFAULT_LIMIT, DEFAULT_LIMIT);
  const query = {
    orderBy: orderBy ?? [{ createdAt: 'desc' }],
    skip: skip ?? 0,
    take: safeTake,
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
