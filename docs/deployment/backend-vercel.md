# Backend — Vercel Deployment

The Express.js backend deploys as a single Vercel Serverless Function, with Prisma ORM connecting to a Supabase-hosted PostgreSQL database.

## Table of Contents

- [Vercel Configuration](#vercel-configuration)
- [Build Process](#build-process)
- [Serverless Function](#serverless-function)
- [Database Migrations](#database-migrations)
- [CORS Configuration](#cors-configuration)
- [SSE Considerations](#sse-considerations)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Vercel Configuration

**File:** `server/vercel.json`

```json
{
  "version": 2,
  "name": "node-js",
  "installCommand": "bun install",
  "buildCommand": "bun run vercel-build",
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.js"
    }
  ],
  "functions": {
    "api/index.js": {
      "maxDuration": 60
    }
  }
}
```

### Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `installCommand` | `bun install` | Uses Bun for fast dependency installation |
| `buildCommand` | `bun run vercel-build` | Runs Prisma migrate + generate |
| `maxDuration` | 60s | Maximum function execution time |
| `routes` | `/(.*) → api/index.js` | All requests routed to single entry point |

## Build Process

The `vercel-build` script in `server/package.json`:

```json
{
  "scripts": {
    "vercel-build": "bunx prisma migrate deploy && bunx prisma generate"
  }
}
```

### Build Steps

1. **Install** — `bun install` installs all dependencies
2. **Migrate** — `prisma migrate deploy` applies pending migrations to the production database
3. **Generate** — `prisma generate` generates the Prisma Client for the deployed environment
4. **Deploy** — Vercel bundles `api/index.js` as a serverless function

### Entry Point

**File:** `server/api/index.js`

This file exports the Express app as a Vercel serverless function handler. All routes (`/api/auth/*`, `/api/videos/*`, `/api/questions/*`, etc.) are handled by this single function.

## Serverless Function

### Limits

| Limit | Value |
|-------|-------|
| Max duration | 60 seconds |
| Max payload | 4.5 MB (Vercel default) |
| Cold start | ~2-5 seconds (Prisma Client init) |
| Memory | 1024 MB (Vercel default) |
| Regions | Auto (defaults to `iad1`) |

### Cold Start Optimization

The Prisma Client uses a singleton pattern to avoid re-initialization on warm invocations:

```typescript
// lib/prisma.ts — singleton prevents multiple instances
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Database Migrations

### Deploying Migrations

Migrations run automatically during `vercel-build`. For manual deployment:

```bash
# From server/ directory
DATABASE_URL="postgresql://..." bunx prisma migrate deploy
```

### Creating New Migrations

```bash
# Development only — never run migrate dev against production
cd server
bunx prisma migrate dev --name describe_your_change
```

### Migration History

The project has 14 migrations tracking schema evolution. See [Database Guide](../backend/database.md) for details.

## CORS Configuration

CORS is configured in the Express middleware chain:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
```

Set `FRONTEND_URL` in Vercel environment variables to restrict origins in production.

## SSE Considerations

Vercel Serverless Functions have a maximum execution time (60s configured). This affects Server-Sent Events:

| Constraint | Handling |
|-----------|----------|
| 60s function timeout | Client reconnects automatically via `Last-Event-ID` |
| No persistent connections | SSE stream closes at timeout; client resumes |
| Heartbeat interval | 25 seconds (fits within Vercel's proxy timeout) |
| Fallback | JSON poll endpoint at `/api/sse/poll` for environments where SSE is unreliable |

The SSE implementation stores events in the `SSEEvent` database table, enabling resumption after disconnection.

## Monitoring

### Vercel Dashboard

- **Functions tab** — Invocation count, duration, errors
- **Logs tab** — Real-time function logs
- **Analytics** — Request volume, response times, error rates

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Quick health check |
| `GET /api/health/health` | Comprehensive check (includes DB connectivity) |
| `GET /api/health/ping` | Simple ping/pong |

## Troubleshooting

### Common Issues

**Migration fails during build**
- Ensure `DATABASE_URL` and `DIRECT_DATABASE_URL` are set in Vercel environment variables
- `DIRECT_DATABASE_URL` should bypass connection pooling (direct connection) for migrations

**Cold start timeouts**
- First request after idle may take 2-5 seconds
- Prisma Client generation is the main contributor
- Consider Vercel's "Always On" or "Fluid Compute" for latency-sensitive endpoints

**CORS errors**
- Verify `FRONTEND_URL` matches the mobile app's API base URL
- For development, temporarily set to `*` or add the dev URL

**Function timeout (60s)**
- File uploads: Use presigned URLs (client uploads directly to R2)
- Large queries: Add pagination (`?page=&limit=`)
- Payment webhooks: Process asynchronously where possible

### Environment Variables

See [Environment Variables](environment-variables.md) for the complete list of required backend variables.
