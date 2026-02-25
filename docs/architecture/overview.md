# System Architecture

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Request Flow](#request-flow)
- [Real-Time Events](#real-time-events)
- [Payment Flow](#payment-flow)
- [Key Architectural Principles](#key-architectural-principles)

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["Mobile App (React Native + Expo)"]
        UI["Screens & Components"]
        ZS["Zustand Stores<br/>(UI State)"]
        TQ["TanStack Query<br/>(Server State)"]
        SSE_C["SSE Client"]
    end

    subgraph API["Backend (Express.js + Bun)"]
        MW["Middleware<br/>(CORS, Auth, JSON)"]
        CTRL["Controllers"]
        PRISMA["Prisma ORM"]
        EB["Event Bus (SSE)"]
    end

    subgraph Infra["Infrastructure"]
        DB[(PostgreSQL)]
        R2["Cloudflare R2<br/>(File Storage)"]
        MTN["MTN MoMo API"]
        AIRTEL["Airtel Money API"]
        SMTP["SMTP Server<br/>(Email)"]
    end

    UI --> ZS
    UI --> TQ
    TQ -->|"REST API"| MW
    SSE_C -->|"SSE Stream"| EB
    MW --> CTRL
    CTRL --> PRISMA
    CTRL --> EB
    CTRL --> R2
    CTRL --> MTN
    CTRL --> AIRTEL
    CTRL --> SMTP
    PRISMA --> DB
    EB --> DB
```

## Request Flow

Every API request follows this pipeline:

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant CORS as CORS Middleware
    participant Auth as Auth Middleware
    participant Ctrl as Controller
    participant DB as Prisma → PostgreSQL
    participant Cache as Cache Layer

    App->>CORS: Request + Bearer Token
    CORS->>CORS: Validate origin
    CORS->>Auth: Pass through
    Auth->>Auth: Verify JWT, set req.user
    Auth->>Ctrl: Authenticated request
    Ctrl->>Cache: Check cache strategy
    alt Cache Hit
        Cache-->>Ctrl: Cached response
    else Cache Miss
        Ctrl->>DB: Prisma query
        DB-->>Ctrl: Result
        Ctrl->>Cache: Store result
    end
    Ctrl-->>App: JSON response
```

### Middleware Chain

```text
Request → CORS → express.json() → cookieParser → [verifyToken] → Controller → Error Handler → Response
```

- **CORS** — Validates origin against allowlist (mobile apps with no origin are allowed)
- **express.json()** — Parses JSON request bodies
- **verifyToken** — Extracts JWT from `Authorization: Bearer <token>`, sets `req.user.id`
- **requireRole** — Optional role-based guard (`ADMIN`, `MODERATOR`)
- **optionalAuth** — Same as verifyToken but continues as anonymous on failure

## Real-Time Events

Server-Sent Events (SSE) deliver real-time updates to connected clients:

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant SSE as SSE Endpoint
    participant EB as Event Bus
    participant DB as SSEEvent Table
    participant Ctrl as Controller

    App->>SSE: GET /api/sse/stream (JWT)
    Note over SSE: Opens persistent connection

    loop Every 3 seconds
        SSE->>DB: Poll for new events
        DB-->>SSE: New events (if any)
        SSE-->>App: event: type\ndata: payload
    end

    loop Every 10 seconds
        SSE-->>App: : heartbeat (keep-alive)
    end

    Note over Ctrl: User action triggers event
    Ctrl->>EB: publishEvent(userId, type, payload)
    EB->>DB: Insert SSEEvent
    Note over DB: 10-minute TTL, auto-cleanup

    SSE->>DB: Next poll picks up event
    SSE-->>App: event: notification.new\ndata: {...}

    Note over SSE: Auto-close after 25s (Vercel limit)
    App->>SSE: Reconnect with Last-Event-ID
```

### Event Types

| Event | Trigger | Payload |
|-------|---------|---------|
| `notification.new` | New notification created | `{ id, title, body, type }` |
| `payment.success` | Payment completed | `{ amount, provider, reference }` |
| `payment.failed` | Payment failed | `{ error, refunded }` |
| `reward.earned` | User earned reward | `{ points, description }` |

## Payment Flow

### Provider Architecture

Each provider has a dedicated config module. The payment controller is a thin orchestrator:

```text
server/lib/
├── mtnConfig.mjs        # MTN: token, phone formatter, headers, amount conversion
│                         # Shared exports: tokenCache, EXPIRY_BUFFER_MS, isSandbox
└── airtelConfig.mjs     # Airtel: token, phone formatter, headers, status classification
                          # Imports shared cache from mtnConfig.mjs

server/controllers/
├── paymentController.mjs          # Imports from BOTH config modules
└── surveyPaymentController.mjs    # Imports from paymentController only
```

### Collection Flow (Subscriptions)

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as API Server
    participant Provider as MTN/Airtel API
    participant DB as PostgreSQL

    App->>API: POST /api/survey-payments/initiate (JWT)
    API->>API: Validate phone + check concurrent guard
    API->>DB: Create Payment (PENDING, featureType, idempotencyKey)
    API->>Provider: Request-to-Pay / Collection
    Provider-->>API: 202 Accepted
    API-->>App: { paymentId, status: PENDING }

    loop Client polls every 3s (5min timeout)
        App->>API: GET /status (JWT)
        API->>Provider: Re-query if PENDING >30s
        API->>DB: Update status if changed
        API-->>App: { status }
    end

    Note over Provider: Async callback (production)
    Provider->>API: POST /callback (HMAC-SHA256)
    API->>API: Verify signature + replay protection
    API->>Provider: Re-query to confirm
    API->>DB: Update Payment status
```

### Disbursement Flow (Reward Payouts)

The 3-phase transaction pattern ensures atomicity for reward redemptions:

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as API Server
    participant DB as PostgreSQL
    participant Pay as MTN/Airtel API

    App->>API: POST /api/rewards/redeem (JWT)
    Note over API: Phase 1: Validate & Deduct (Transaction)

    API->>DB: BEGIN TRANSACTION
    API->>DB: Check user.points >= required
    API->>DB: Deduct points atomically
    API->>DB: Create RewardRedemption (PENDING)
    API->>DB: COMMIT

    Note over API: Phase 2: Call Payment Provider (Outside TX)

    API->>Pay: processMtnPayment / processAirtelPayment
    Pay-->>API: { success, reference }

    Note over API: Phase 3: Finalize (Transaction)

    API->>DB: BEGIN TRANSACTION
    alt Payment Succeeded
        API->>DB: Update RewardRedemption → SUCCESSFUL
        API->>DB: Store transactionRef
    else Payment Failed
        API->>DB: Update RewardRedemption → FAILED
        API->>DB: Refund points (increment)
    end
    API->>DB: COMMIT

    API-->>App: { success, message, transactionRef }
```

### Why 3 Phases?

1. **Phase 1 (Transaction):** Points deducted atomically — prevents double-spending
2. **Phase 2 (No Transaction):** Payment API call outside DB transaction — avoids long-held locks during external network calls
3. **Phase 3 (Transaction):** Final status + refund on failure — guarantees consistency

### Security Measures

- **Route auth:** All payment routes require JWT; disbursement requires admin role
- **Callback auth:** HMAC-SHA256 with 5-minute replay window (no JWT)
- **State guard:** SUCCESSFUL payments cannot be reverted
- **Phone validation:** Both formatters throw on invalid MSISDN before any API call
- **Token caching:** Per-product OAuth tokens with 10-min expiry buffer + thundering herd guard
- **Idempotency:** Client-generated UUID stored as `@unique` on Payment model

## Key Architectural Principles

### State Separation

```text
┌─────────────────────────────────────────────┐
│                  Mobile App                  │
├──────────────┬──────────────┬───────────────┤
│   Zustand    │ TanStack     │  SecureStore   │
│   (UI State) │ Query        │  (Auth Tokens) │
│              │ (Server      │                │
│  Tabs, forms │  State)      │  accessToken   │
│  drafts, UI  │              │  refreshToken  │
│  preferences │  API data,   │                │
│              │  cache,      │  AsyncStorage   │
│  Persisted   │  background  │  (Preferences)  │
│  to          │  refetch     │                │
│  AsyncStorage│              │                │
└──────────────┴──────────────┴───────────────┘
```

### Optimistic Updates

Mutations update Zustand stores immediately, then sync with the server. On server failure, the optimistic state is rolled back:

```text
User taps Like → Zustand toggleLike() → UI updates instantly
                → likeVideoMutate() → Server request
                     ├─ onSuccess: confirmed
                     └─ onError: toggleLike() rollback
```

### Offline-First

Critical operations (reward submissions, uploads) are queued when offline:

```text
User submits answer → Online? → Yes → API call
                              → No  → addPendingSubmission()
                                       ↓
                              Network restored → useOfflineQueueProcessor
                                                 flushes queue
```

### Denormalized Counters

High-read fields use denormalized counters maintained via Prisma `$transaction`:

```text
Video.likes     — incremented/decremented on like/unlike
Video.views     — incremented on view
Video.commentsCount — incremented on comment create
RewardQuestion.winnersCount — incremented on winner allocation
```

This avoids expensive `COUNT(*)` queries on every read.
