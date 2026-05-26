# P0 Play-Store-Blocker Changes

Engineering reference for the P0 work landed on 2026-04-14. Scope was intentionally narrow: everything Google Play requires before launch, plus the trust / fraud essentials that protect payouts on day one. P1–P4 uplift (biometrics, social login, i18n, design refresh, perf migration) is deferred.

See also: `.github/workflows/` for the CI/CD wiring, `server/prisma/migrations/20260414120000_p0_play_store_blockers/` for the schema change.

## What landed

### 1. Crash reporting (Sentry)

Client + server. PII-redacting `beforeSend` hooks strip `authorization`, `cookie`, `password`, `refreshToken`, `code`, `token`, `phoneNumber`. Sentry is wrapped around the Expo Router root and the Express error handler.

| File | Purpose |
|---|---|
| `DelipuCash/utils/sentry.ts` | Client helper — `initSentry`, `identifyUser`, `captureException`, `addBreadcrumb` |
| `DelipuCash/app/_layout.tsx` | Calls `initSentry()` at module load, wraps root with `Sentry.wrap()`, syncs user on auth change |
| `DelipuCash/components/ErrorBoundary.tsx` | Routes caught render errors into `captureException` |
| `DelipuCash/services/api.ts` | Adds API breadcrumbs + content-type guard for every `fetchJson` call |
| `server/lib/sentry.mjs` | Server init — `@sentry/node` + `@sentry/profiling-node` |
| `server/index.js` | Imports Sentry module first; registers `Sentry.setupExpressErrorHandler` before custom error middleware |

**Env:** `EXPO_PUBLIC_SENTRY_DSN` (mobile), `SENTRY_DSN` + `SENTRY_ENVIRONMENT` (server), `SENTRY_AUTH_TOKEN` in EAS build secrets for source-map upload.

### 2. Account deletion (Play Store policy)

Google Play requires in-app deletion and a public URL.

| Endpoint | Auth | Behaviour |
|---|---|---|
| `POST /api/auth/delete-account` | JWT + password + OTP (if 2FA) | Soft-delete via `AppUser.deletedAt`, wipe PII, refund PENDING redemptions, revoke all sessions, clear push token |
| `GET /delete-account` | public | HTML landing page (policy requirement) |

Client entry in `Profile → Delete Account` via new `components/profile/DeleteAccountSheet.tsx` — double-confirmation, re-auth required.

### 3. User data export (GDPR / Play Data Safety)

| Endpoint | Auth | Behaviour |
|---|---|---|
| `POST /api/users/export-data` | JWT | Assembles all user records → JSON → R2 (48h presigned) → emails link |

Fire-and-forget pattern: 202 returns immediately, R2 upload + email run in background to avoid Vercel function timeouts. Entry in `Profile → Export My Data`.

### 4. Expo Push replaces long-lived SSE

SSE backend retained for forward-compat; client no longer subscribes (`SSEStore.isEnabled` default = `false`). Canonical delivery is now Expo Push Service. TanStack Query adaptive polling (30–60s) is the offline fallback and kicks in automatically.

| File | Purpose |
|---|---|
| `server/lib/push.mjs` | `expo-server-sdk` wrapper — batching, receipts, invalid-token cleanup |
| `server/controllers/notificationController.mjs` | Every `publishEvent` is paired with `pushService.send()` |
| `DelipuCash/utils/usePushNotifications.tsx` | Registers token after auth, retries via `onlineManager`, invalidates relevant query keys on receipt, deep-links from `actionUrl` |
| `POST /api/auth/push-token` | New route — stores `expoPushToken` on `AppUser` |

### 5. Redemption hardening — Play Integrity + velocity + MoMo OTP

`POST /api/rewards/redeem` is now gated by:

1. **Play Integrity** (Android) via `requireIntegrity()` middleware. Nonce issued from `GET /api/rewards/integrity-nonce`, verified against `playintegrity.googleapis.com/v1/<package>:decodeIntegrityToken`. Fails closed.
2. **Velocity rules**: max 3 successful+pending redemptions per 24h, min 5 minutes between attempts. Returns 429 with `VELOCITY_24H` / `VELOCITY_BURST` codes.
3. **MoMo phone ownership**: first withdrawal to a given MSISDN requires OTP. Verified numbers stored in `AppUser.verifiedMomoNumbers` (JSON).

| Endpoint | Auth | Behaviour |
|---|---|---|
| `GET /api/rewards/integrity-nonce` | JWT | Issues a single-use nonce (5-min TTL) |
| `POST /api/rewards/verify-phone-send` | JWT, rate-limited 60s | Sends 6-digit OTP via existing email service |
| `POST /api/rewards/verify-phone` | JWT | Verifies code + adds MSISDN to `verifiedMomoNumbers` |

### 6. Referral program

Schema-backed. Both sides earn 500 pts on the invitee's **first successful redemption** (not signup — prevents farming).

| Component | Purpose |
|---|---|
| `prisma.referral` (new model) | `status: PENDING → QUALIFIED → PAID`, unique `inviteeId` |
| `auth.controller.signup` | Creates `Referral` row alongside existing signup bonus |
| `rewardController.qualifyReferralOnFirstRedemption` | Atomic transaction — runs on first `SUCCESSFUL` redemption, gated on `successfulCount === 1` |
| `GET /api/auth/referral` | Returns code, share URL, counts by status |
| `DelipuCash/app/referrals.tsx` | Share + stats screen |
| `DelipuCash/app/invite/[code].tsx` | Deep-link handler — stashes code in AsyncStorage for fresh installs |
| `GET /invite/:code` (backend) | Landing page with app deep-link + store CTAs |

### 7. EAS Update OTA channels

| File | Change |
|---|---|
| `app.json` | `runtimeVersion.policy: "fingerprint"`, `updates.url`, `intentFilters` for `/invite/*` |
| `eas.json` | `channel: "preview"` / `"production"` per profile |
| `.github/workflows/eas-update.yml` | Tag `v*` triggers `eas update --channel production` |

### 8. CI/CD

| Workflow | Trigger | Job |
|---|---|---|
| `.github/workflows/ci.yml` | PR / push to main | Mobile typecheck + lint + Jest; server Bun tests |
| `.github/workflows/maestro.yml` | PR touching `DelipuCash/**` or `.maestro/**` | Android emulator smoke — auth + instant-reward + redeem |
| `.github/workflows/deploy-server.yml` | Push to main with `server/**` changes | Vercel `--prebuilt --prod` |
| `.github/workflows/eas-update.yml` | Tag `v*` | `eas update --channel production` |

Existing `.github/workflows/secret-scan.yml` (TruffleHog + GGShield) remains.

### 9. Tests

| File | Coverage |
|---|---|
| `server/test/rewardController.test.js` | Phone validation, velocity arithmetic, `isPhoneVerified` |
| `server/test/playIntegrity.test.js` | Nonce generation, middleware shape (iOS skip, Android fail-closed) |
| `server/test/dataExport.test.js` | Module surface smoke |
| `DelipuCash/__tests__/sentry.test.ts` | Helper degrades gracefully with no DSN |
| `DelipuCash/__tests__/instantRewardStore.test.ts` | Selector pure functions |
| `.maestro/auth.yaml`, `instant-reward.yaml`, `redeem.yaml` | End-to-end smoke |

## Schema change

Single additive migration at `server/prisma/migrations/20260414120000_p0_play_store_blockers/migration.sql`.

```sql
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'PAID');

ALTER TABLE "AppUser" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedReason" TEXT,
ADD COLUMN "expoPushToken" TEXT,
ADD COLUMN "lastDeviceId" TEXT,
ADD COLUMN "pushTokenUpdatedAt" TIMESTAMP(3),
ADD COLUMN "verifiedMomoNumbers" JSONB;

CREATE TABLE "Referral" (id, inviterId, inviteeId, status, rewardPoints, qualifiedAt, paidAt, createdAt, updatedAt);
-- plus indexes + FKs
```

All nullable / defaulted — safe to apply to a live database without downtime.

## Offline / intermittent-connectivity behaviour

| Feature | Offline behaviour |
|---|---|
| Push-token registration | Queued in `pendingRegistrationRef`, retried on `onlineManager` reconnect |
| Account deletion | Toast on failure, idempotent retry (server 409 if already deleted) |
| Data export | Toast on failure, retry-safe |
| Referral fetch | Standard TanStack retry, cached via AsyncStorage persister |
| Redemption | Server returns specific error codes; integrity nonce TTL-protected so half-flow retries are safe |
| Notifications | 30s polling fallback; list cached via persister |
| Reward submissions | Pre-existing `useOfflineQueueProcessor` (max 3 retries, discard on permanent fail) |
| Sentry events | Built-in `@sentry/react-native` offline buffer |

## What still needs to be fixed / done before shipping

### Blocking

1. **Apply the Prisma migration to production**
   Current Supabase project returned `Tenant or user not found` from the pooler — most likely paused (free-tier inactivity) or credentials rotated. Unblock, then:
   ```
   cd server && bunx prisma migrate deploy && bunx prisma generate
   ```
   The migration itself is fully additive and safe against live traffic.

2. **Set production env vars**
   - Mobile (EAS + `.env`): `EXPO_PUBLIC_SENTRY_DSN`
   - EAS build secrets: `SENTRY_AUTH_TOKEN` (for source-map upload)
   - Server (Vercel env): `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`, `PLAY_INTEGRITY_PACKAGE_NAME=com.arolainc.DelipuCash`, `GOOGLE_CLOUD_PROJECT_NUMBER`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`, `EXPO_ACCESS_TOKEN` (optional), `SUPPORT_EMAIL`
   - GitHub Actions secrets: `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, optionally `MAESTRO_API_TOKEN`

3. **Provision Google Play Integrity**
   - Enable Play Integrity API in Google Cloud Console
   - Create a service account with `Play Integrity API > Play Integrity User` role
   - Paste the service-account JSON into `GOOGLE_APPLICATION_CREDENTIALS_JSON` (single line)
   - Link the Play Console app to the Cloud project. Takes 24 hours to propagate.

4. **Install the Play Integrity native SDK on the client**
   Currently the server expects `X-Play-Integrity-Token` + `X-Play-Integrity-Nonce` headers from Android clients, but the client code to obtain them is not yet added. Options:
   - `expo-play-integrity` (unofficial) — simplest drop-in
   - Config-plugin wrapping the Google Play Integrity Android library directly
   Until this is wired, Android redemption will fail closed with `INTEGRITY_FAILED` (desired fallback, but blocks users). See `server/lib/playIntegrity.mjs` — `not_configured` currently lets requests through, which is the dev-env escape hatch; **switch to strict mode in production once the client is wired**.

5. **Run `eas update:configure`**
   Interactive; needs browser auth. Confirms `app.json` `updates.url` matches the Expo project.

6. **Play Console checklist**
   - Complete Data Safety form (deletion + export endpoints now satisfy this)
   - Add `GET /delete-account` URL to the Play Console account-deletion field
   - Upload first AAB built with `eas build --platform android --profile production`

### Known gaps to address right after launch

- **iOS parity for Play Integrity** — App Attest / DeviceCheck equivalent. Currently iOS redemption bypasses integrity check via `skipOnIos: true`.
- **Push token cleanup on permission revoke** — if a user toggles notifications off from the OS, we don't proactively clear the token server-side until Expo reports `DeviceNotRegistered` on a send attempt. Minor, but leaves stale rows.
- **Repo bloat** — `DelipuCash/build-1772205972985.apk` and `DelipuCash/build-1772726890521.apk` (~340 MB committed). Remove from git history before any new collaborator clones.
- **Integration tests with real DB** — server tests currently mock Prisma. A Docker-Postgres CI service would let us exercise the 3-phase redemption end-to-end.

## Deferred (explicitly out of scope for P0)

| Phase | Items |
|---|---|
| P1 | Biometric unlock (`expo-local-authentication`), Google + Apple Sign-In, in-app review prompt, feature flags (GrowthBook self-host), product analytics (PostHog self-host), i18n (Luganda/Swahili) |
| P2 | FlashList migration, MMKV for hot-path storage, remove unused heavy deps (`three`, `expo-three`, `html-to-image`, `react-native-graph`), Cloudflare Stream for adaptive-bitrate video |
| P3 | Color palette refresh, token ramp consolidation, motion spec, haptic vocabulary, glassmorphism |
| P4 | Certificate pinning, Upstash Ratelimit on auth + redeem routes, HMAC secret rotation, log-redaction audit |

## Verification checklist

Run each on a test device after the blocking items above are done:

1. **Sentry** — throw a test error from `app/api-test.tsx`; confirm readable stack in Sentry dashboard with source maps
2. **Push** — `node -e "import('./server/lib/push.mjs').then(m => m.default.send('<userId>', { title: 'Test', body: 'OK' }))"`; device receives notification in killed-app state
3. **Account deletion** — sign up disposable account, delete via Profile flow, confirm: `AppUser.deletedAt` set, sign-in fails, pending redemptions cancelled, points refunded
4. **Data export** — trigger export, check email arrives in <5 min, ZIP has valid JSON for every collection
5. **Play Integrity** — redeem on real device (succeeds), redeem on emulator (rejected with `INTEGRITY_FAILED`)
6. **Velocity** — attempt 4 redemptions in 24h; 4th returns 429 with `VELOCITY_24H` code
7. **Phone verification** — new MSISDN triggers OTP challenge; after verify, subsequent redemptions to same number skip it
8. **Referral** — user A shares link → user B installs via link → B completes first successful redemption → both get 500 pts in their balance and `REFERRAL_BONUS` notification
9. **EAS Update** — publish cosmetic change to `production` channel; existing install picks it up on next cold start
10. **Maestro smoke** — `maestro test .maestro/` on Android emulator, all three flows green
