# DelipuCash Documentation

> A mobile rewards platform where users earn cash by answering questions, completing surveys, and watching videos — with instant MTN & Airtel Mobile Money payouts.

## Quick Links

| Section | Description |
|---------|-------------|
| [Getting Started](getting-started.md) | Setup guide for new developers |
| [Architecture](architecture/overview.md) | System design, diagrams, and data model |
| [Backend](backend/README.md) | Express.js API, authentication, payments |
| [Frontend](frontend/README.md) | React Native screens, components, state |
| [Deployment](deployment/README.md) | Vercel, EAS Build, environment config |
| [Contributing](contributing/README.md) | Code style, PR workflow, testing |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native 0.81 + Expo SDK 54 (TypeScript) |
| Routing | Expo Router 6 (file-based) |
| UI State | Zustand 5 (persisted via AsyncStorage) |
| Server State | TanStack Query 5.90 |
| Animations | React Native Reanimated 4.1 |
| Backend | Express.js 4.22 + Bun runtime |
| Database | PostgreSQL + Prisma 7.4 ORM |
| File Storage | Cloudflare R2 (S3-compatible) |
| Payments | MTN MoMo + Airtel Money APIs |
| Real-time | Server-Sent Events (SSE) |
| Auth | JWT (access + refresh tokens) with 2FA |
| Backend Deploy | Vercel Serverless Functions |
| Mobile Deploy | EAS Build (iOS + Android) |

## Repository Structure

```text
delipucash_latest/
├── DelipuCash/              # React Native + Expo frontend
│   ├── app/                 # Screens (Expo Router file-based routing)
│   ├── components/          # Reusable UI components (141 files)
│   ├── store/               # Zustand stores (15 stores)
│   ├── services/            # API client, TanStack Query hooks, SSE
│   ├── utils/               # Theme, validation, helpers
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript type definitions
│   └── assets/              # Images, fonts
├── server/                  # Express.js backend
│   ├── controllers/         # Route handlers
│   ├── routes/              # Express route definitions
│   ├── lib/                 # Prisma client, R2, email, cache, SSE
│   ├── utils/               # Auth middleware, token utils, helpers
│   ├── prisma/              # Schema, migrations, seed
│   ├── scripts/             # Mock data seeding
│   └── api/                 # Vercel serverless entry point
└── docs/                    # This documentation
```

## Documentation Map

### Architecture

- [System Overview](architecture/overview.md) — High-level diagrams and request flows
- [Tech Stack](architecture/tech-stack.md) — Technology choices and versions
- [Data Model](architecture/data-model.md) — All Prisma models, enums, and relations
- [Architecture Decisions](architecture/decisions/adr-template.md) — ADR template

### Backend

- [Backend Overview](backend/README.md) — Directory structure and local setup
- [API Reference](backend/api-reference.md) — 100+ endpoints organized by domain
- [Authentication](backend/authentication.md) — JWT, 2FA, sessions, password reset
- [Payments](backend/payments.md) — MTN/Airtel integration, redemption flow
- [Real-time (SSE)](backend/realtime.md) — Event streaming architecture
- [File Storage (R2)](backend/storage.md) — Cloudflare R2 upload system
- [Database](backend/database.md) — Prisma setup, caching, migrations

### Frontend

- [Frontend Overview](frontend/README.md) — Directory structure and conventions
- [Navigation](frontend/navigation.md) — Route tree, deep linking, auth flow
- [State Management](frontend/state-management.md) — Zustand + TanStack Query
- [Screens](frontend/screens.md) — All 41 screens by feature area
- [Components](frontend/components.md) — Component library reference
- [Services](frontend/services.md) — API client, hooks, SSE manager
- [Design System](frontend/theming.md) — Tokens, colors, typography
- [Performance](frontend/performance.md) — Optimization patterns

### Operations

- [Deployment Overview](deployment/README.md) — Infrastructure summary
- [Backend (Vercel)](deployment/backend-vercel.md) — Serverless deployment
- [Frontend (EAS)](deployment/frontend-eas.md) — Mobile app builds
- [Environment Variables](deployment/environment-variables.md) — All config vars

### Contributing

- [Contributing Guide](contributing/README.md) — Code style and workflow
- [Testing](contributing/testing.md) — Test setup and conventions
