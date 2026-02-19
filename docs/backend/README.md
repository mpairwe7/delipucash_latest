# Backend Documentation

The DelipuCash backend is an Express.js REST API running on Bun, with Prisma ORM for PostgreSQL, JWT authentication, MTN/Airtel payment integration, Cloudflare R2 storage, and Server-Sent Events for real-time updates.

## Directory Structure

```text
server/
├── api/
│   └── index.js               # Vercel serverless entry point
├── controllers/
│   ├── auth.controller.mjs     # Signup, signin, 2FA, password reset
│   ├── questionController.mjs  # Questions CRUD, voting, responses
│   ├── responseController.mjs  # Response likes, dislikes, replies
│   ├── surveyController.mjs    # Survey CRUD, submissions, analytics
│   ├── surveyWebhookController.mjs  # Survey webhook CRUD, test delivery
│   ├── surveyFileController.mjs     # Survey file upload handler
│   ├── surveyCollabController.mjs   # Real-time collaboration sessions
│   ├── surveyTemplateController.mjs # Custom survey template CRUD
│   ├── videoController.mjs     # Video CRUD, likes, bookmarks, livestream
│   ├── rewardController.mjs    # Rewards, points, redemption
│   ├── rewardQuestionController.mjs  # Reward questions, instant rewards
│   ├── paymentController.mjs   # MTN/Airtel disbursement, webhooks
│   ├── surveyPaymentController.mjs   # Survey subscription payments
│   ├── AdController.mjs        # Ad CRUD, moderation, tracking
│   ├── userController.mjs      # Profile, privacy, sessions
│   ├── notificationController.mjs    # Notifications CRUD, templates
│   ├── r2UploadController.mjs  # R2 file uploads, presigned URLs
│   ├── sseController.mjs       # SSE stream, poll endpoint
│   └── exploreController.mjs   # Explore feed
├── routes/
│   ├── auth.route.mjs          # /api/auth/*
│   ├── questionRoutes.mjs      # /api/questions/*
│   ├── responseRoutes.mjs      # /api/responses/*
│   ├── surveyRoutes.mjs        # /api/surveys/*
│   ├── surveyCollabRoutes.mjs  # /api/surveys/:surveyId/collab/*
│   ├── videoRoutes.mjs         # /api/videos/*
│   ├── rewardRoutes.mjs        # /api/rewards/*
│   ├── rewardQuestionRoutes.mjs  # /api/reward-questions/*
│   ├── paymentRoutes.mjs       # /api/payments/*
│   ├── surveyPaymentRoutes.mjs # /api/survey-payments/*
│   ├── AdRoutes.mjs            # /api/ads/*
│   ├── userRoutes.mjs          # /api/users/*
│   ├── notificationRoutes.mjs  # /api/notifications/*
│   ├── r2UploadRoutes.mjs      # /api/r2/*
│   ├── sseRoutes.mjs           # /api/sse/*
│   ├── quizRoutes.mjs          # /api/quiz/*
│   ├── surveySubscriptionRoutes.mjs  # /api/survey-subscriptions/*
│   ├── attemptRoutes.mjs       # /api/attempts/*
│   └── exploreRoutes.mjs       # /api/explore/*
├── lib/
│   ├── prisma.mjs              # Prisma client singleton
│   ├── r2.mjs                  # Cloudflare R2 S3 client
│   ├── emailService.mjs        # SMTP email (2FA, password reset)
│   ├── eventBus.mjs            # SSE event publishing
│   ├── webhookDispatcher.mjs   # Webhook delivery with HMAC-SHA256 signing
│   ├── cacheStrategies.mjs     # Prisma cache tier configs
│   └── queryStrategies.mjs     # Safe pagination, optimized queries
├── utils/
│   ├── verifyUser.mjs          # JWT auth middleware
│   ├── tokenUtils.mjs          # Token generation, rotation, hashing
│   ├── error.mjs               # Error helper
│   └── adminInit.mjs           # Default admin user creation
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.mjs                # Admin user seed
│   └── migrations/             # 14 migration files
├── scripts/
│   ├── seed-mock-data.mjs      # Comprehensive mock data seeder
│   ├── seed-ads-only.mjs       # Ad-only seeder
│   └── seed-videos.mjs         # Video seeder
├── index.js                    # Express app setup & startup
├── vercel.json                 # Vercel deployment config
└── package.json                # Dependencies & scripts
```

## Local Development

```bash
cd server
bun install
cp .env.example .env  # Edit with your values
bun prisma generate
bun prisma migrate dev
bun run db:seed
bun run dev  # Starts on http://localhost:3000
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun --watch index.js` | Development server with hot reload |
| `start` | `bun index.js` | Production start |
| `build` | `prisma generate` | Generate Prisma client |
| `vercel-build` | `prisma generate && prisma migrate deploy` | Vercel build step |
| `db:push` | `bun prisma db push` | Push schema without migration |
| `db:studio` | `bun prisma studio` | Open Prisma Studio GUI |
| `db:reset` | `bun prisma migrate reset` | Reset database |
| `db:seed` | `bun prisma/seed.mjs` | Seed admin user |
| `seed:mock` | `bun scripts/seed-mock-data.mjs` | Seed mock data |

## Related Documentation

- [API Reference](api-reference.md) — All endpoints
- [Authentication](authentication.md) — JWT, 2FA, sessions
- [Payments](payments.md) — MTN/Airtel integration
- [Real-time (SSE)](realtime.md) — Event streaming
- [File Storage (R2)](storage.md) — Upload system
- [Database](database.md) — Prisma, caching, migrations
