# Tech Stack

## Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile framework |
| Expo SDK | 54.0.33 | Managed native modules & build tooling |
| React | 19.1.0 | UI library |
| TypeScript | 5.9.3 | Type safety |
| Expo Router | 6.0.23 | File-based navigation |
| Zustand | 5.0.3 | Client-side state management |
| TanStack Query | 5.90.21 | Server state, caching, background sync |
| Reanimated | 4.1.6 | Native-thread 60fps animations |
| Moti | 0.30.0 | Declarative animation wrappers |
| AsyncStorage | 2.2.0 | Persistent key-value store |
| SecureStore | (Expo) | Encrypted token storage |
| Lucide Icons | 0.525.0 | Icon library |
| React Native SVG | 15.12.1 | SVG rendering |
| Yup | 1.7.1 | Schema validation |
| date-fns | 4.1.0 | Date utilities |
| RevenueCat | 9.9.0 | In-app purchases & subscriptions |

### Key Expo Modules

| Module | Purpose |
|--------|---------|
| expo-video | Video playback (replaces expo-av) |
| expo-camera | Camera access for recording/livestream |
| expo-image | Optimized image component |
| expo-image-picker | Photo/video selection from gallery |
| expo-haptics | Haptic feedback patterns |
| expo-notifications | Push notification handling |
| expo-linking | Deep link handling |
| expo-file-system | File read/write |
| expo-screen-orientation | Orientation control |

### Build & Tooling

| Tool | Purpose |
|------|---------|
| EAS CLI 16.31+ | Cloud builds for iOS & Android |
| Metro Bundler | JavaScript bundler |
| React Compiler | Experimental automatic memoization |
| Typed Routes | Type-safe navigation |
| Babel | Transpilation with expo preset |
| ESLint | Code linting (expo config) |

## Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Bun | 1.3+ | JavaScript runtime & package manager |
| Express.js | 4.22.1 | HTTP server framework |
| Prisma | 7.4.0 | Database ORM |
| @prisma/adapter-pg | 7.4.0 | PostgreSQL adapter with connection pooling |
| PostgreSQL | 15+ | Relational database |
| jsonwebtoken | 9.0.3 | JWT generation & verification |
| bcryptjs | 2.4.3 | Password hashing (salt rounds: 10) |
| Nodemailer | 6.10.1 | SMTP email delivery |
| AWS SDK v3 (S3) | Latest | Cloudflare R2 (S3-compatible) uploads |
| express-async-handler | 1.2.0 | Async error propagation |
| cookie-parser | 1.4.7 | Cookie handling |
| cors | 2.8.5 | Cross-Origin Resource Sharing |

## Infrastructure

| Service | Purpose |
|---------|---------|
| Vercel | Backend serverless deployment |
| Supabase | Managed PostgreSQL + PgBouncer |
| Cloudflare R2 | S3-compatible object storage (videos, images) |
| MTN MoMo API | Mobile money disbursements (Uganda) |
| Airtel Money API | Mobile money disbursements (Uganda) |
| SMTP (Gmail) | Transactional email (2FA, password reset) |

## Architecture Patterns

| Pattern | Implementation |
|---------|---------------|
| State separation | Zustand (UI) + TanStack Query (server) + SecureStore (auth) |
| Optimistic updates | Zustand immediate → server confirm → rollback on error |
| Offline-first | Pending submission queue, flushed on reconnect |
| Ref-mirrored state | `useRef` mirrors `useState` for stable `useCallback` identities |
| IAB viewability | 50% visible for 1s (display) / 2s (video) |
| 3-phase transactions | Deduct → pay → confirm/refund for payment safety |
| Token rotation | Refresh tokens with family-based reuse detection |
| Cache strategies | 5 tiers: none → shortLived → standard → longLived → aggressive |

## Version Compatibility

```text
React Native 0.81 requires:
  - iOS deployment target: 15.1+
  - Android minSdk: 24 (Android 7.0+)
  - Android targetSdk: 35
  - Android compileSdk: 35
  - New Architecture: enabled
  - Hermes: default JS engine
```
