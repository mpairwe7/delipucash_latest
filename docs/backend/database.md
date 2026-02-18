# Database Guide

## Table of Contents

- [Prisma Setup](#prisma-setup)
- [Connection Pooling](#connection-pooling)
- [Cache Strategies](#cache-strategies)
- [Query Optimization](#query-optimization)
- [Migration Workflow](#migration-workflow)
- [Seeding](#seeding)

## Prisma Setup

**File:** `server/lib/prisma.mjs`

The Prisma client is a singleton to prevent connection leaks in serverless environments:

```javascript
// Singleton pattern — reuses client across hot reloads
const prisma = globalThis.__prisma || new PrismaClient({
  adapter: new PrismaPg(pool),
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
```

Graceful shutdown disconnects the client:

```javascript
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

## Connection Pooling

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Max connections | 2 | PgBouncer handles concurrency |
| Idle timeout | 20 seconds | Free unused connections |
| Connection timeout | 10 seconds | Fail fast |

### Runtime vs Migration URLs

| Context | URL | Port | Purpose |
|---------|-----|------|---------|
| Runtime queries | `DATABASE_URL` | 6543 | PgBouncer pooled connection |
| Migrations | `DIRECT_DATABASE_URL` | 5432 | Direct PostgreSQL connection |

Prisma migrations require a direct connection because PgBouncer transaction mode doesn't support DDL statements.

## Cache Strategies

**File:** `server/lib/cacheStrategies.mjs`

Five cache tiers for different data freshness requirements:

| Strategy | TTL | SWR | Use Cases |
|----------|-----|-----|-----------|
| `none` | 0 | 0 | Payments, instant rewards |
| `shortLived` | 30s | 10s | Notifications, feeds, responses |
| `standard` | 5m | 1m | User profiles, questions, surveys |
| `longLived` | 1h | 10m | Videos, ads, static content |
| `aggressive` | 24h | 1h | Leaderboards, public stats |

**SWR (Stale-While-Revalidate):** Serves cached data immediately while fetching fresh data in the background.

### Per-Model Recommendations

| Model | Strategy |
|-------|----------|
| AppUser | standard |
| Question, RewardQuestion | shortLived |
| Response, Attempt | shortLived |
| Payment, InstantRewardWinner | none |
| Video, Ad | longLived |
| Notification | shortLived |
| Survey, UploadSurvey | standard |

## Query Optimization

**File:** `server/lib/queryStrategies.mjs`

### Safe Pagination

```javascript
buildOptimizedQuery('Video', {
  where: { userId },
  orderBy: [{ createdAt: 'desc' }],
  skip: 0,
  take: 20,
});
```

Enforced limits:

- Maximum page size: 100 items
- Default ordering: `createdAt DESC`
- Safe skip/take calculation

### Resilient Queries

Handle schema migration lag (when Prisma client is ahead of deployed schema):

```javascript
async function resilientQuestionFindMany(query) {
  try {
    return await prisma.question.findMany(query);
  } catch (err) {
    if (err?.message?.includes('Unknown field')) {
      // Fallback: remove extended fields and retry
      return await prisma.question.findMany({ ...query, select: BASIC_SELECT });
    }
    throw err;
  }
}
```

### Denormalized Counters

Instead of `COUNT(*)` aggregates on every read:

```javascript
// Like video — atomic increment
await prisma.$transaction([
  prisma.videoLike.create({ data: { userId, videoId } }),
  prisma.video.update({ where: { id: videoId }, data: { likes: { increment: 1 } } }),
]);

// Unlike — atomic decrement
await prisma.$transaction([
  prisma.videoLike.delete({ where: { userId_videoId: { userId, videoId } } }),
  prisma.video.update({ where: { id: videoId }, data: { likes: { decrement: 1 } } }),
]);
```

### N+1 Prevention

Response counts use `_count` aggregate instead of individual queries:

```javascript
const responses = await prisma.response.findMany({
  where: { questionId },
  include: {
    _count: { select: { likes: true, dislikes: true, replies: true } },
    user: { select: { id: true, firstName: true, avatar: true } },
  },
});
```

## Migration Workflow

### Development

```bash
# Create a new migration
bun prisma migrate dev --name descriptive_name

# Apply pending migrations
bun prisma migrate dev

# Reset database (destructive)
bun prisma migrate reset
```

### Production (Vercel)

Migrations are applied during the Vercel build step:

```bash
prisma generate && prisma migrate deploy
```

### Migration History

| # | Migration | Date | Description |
|---|-----------|------|-------------|
| 1 | `latest` | 2026-02-05 | Initial schema |
| 2 | `add_question_reward_fields` | 2026-02-07 | Reward fields on questions |
| 3 | `add_question_vote_model` | 2026-02-07 | QuestionVote model |
| 4 | `add_survey_reward_fields` | 2026-02-08 | Reward fields on surveys |
| 5 | `add_sse_event_log` | 2026-02-13 | SSEEvent model |
| 6 | `add_refresh_token_fields` | 2026-02-15 | Token rotation support |
| 7 | `survey_overhaul` | 2026-02-16 | Survey schema redesign |
| 8 | `add_video_like_bookmark_tables` | 2026-02-16 | Per-user likes/bookmarks |
| 9 | `add_question_stats_time_indexes` | 2026-02-16 | Performance indexes |
| 10 | `add_update_question_index_references` | 2026-02-16 | Index refinements |
| 11 | `reward_rewardwiner_tracking` | 2026-02-18 | Winner tracking |
| 12 | `add_2fa_rate_limiting` | 2026-02-18 | 2FA brute-force protection |
| 13 | `add_reward_redemption` | 2026-02-18 | RewardRedemption model |

## Seeding

### Admin Seed

**File:** `server/prisma/seed.mjs`

Creates a default admin user on first run:

| Field | Value |
|-------|-------|
| Email | admin@delipucash.com |
| Password | admin123456 (bcrypt hashed) |
| Role | ADMIN |
| Points | 100,000 |

Run: `bun run db:seed`

### Mock Data Seed

**File:** `server/scripts/seed-mock-data.mjs`

Seeds comprehensive test data via API calls:

- Test users with authentication
- Questions with responses and votes
- Surveys with questions and responses
- Videos with comments and likes
- Advertisements
- Payments and rewards

Run: `bun run seed:mock`

### Prisma Studio

Visual database browser:

```bash
bun run db:studio
# Opens at http://localhost:5555
```
