# Authentication System

## Table of Contents

- [Overview](#overview)
- [JWT Token Flow](#jwt-token-flow)
- [Token Rotation](#token-rotation)
- [Two-Factor Authentication](#two-factor-authentication)
- [Password Reset](#password-reset)
- [Session Management](#session-management)
- [Middleware Reference](#middleware-reference)

## Overview

DelipuCash uses JWT-based authentication with short-lived access tokens and long-lived refresh tokens. The system supports 2FA via email OTP and tracks login sessions for multi-device management.

| Component | Implementation |
|-----------|---------------|
| Access Token | JWT, 15-minute expiry |
| Refresh Token | 64-char hex string, 30-day expiry |
| Password Hash | bcrypt (salt rounds: 10) |
| 2FA | 6-digit OTP via email, SHA-256 stored |
| Token Storage | SHA-256 hashed in `LoginSession` table |
| Client Storage | SecureStore (encrypted, native keychain) |

## JWT Token Flow

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as Backend
    participant DB as Database

    Note over App,API: Signup / Signin

    App->>API: POST /api/auth/signin { email, password }
    API->>DB: Find user by email
    API->>API: bcrypt.compare(password, hash)
    alt 2FA Enabled
        API-->>App: { requires2FA: true }
        App->>API: POST /api/auth/two-factor/verify-login { email, code }
    end
    API->>DB: Create/update LoginSession
    API-->>App: { accessToken, refreshToken, user }

    Note over App,API: Authenticated Requests

    App->>API: GET /api/videos/all (Authorization: Bearer <accessToken>)
    API->>API: jwt.verify(token, JWT_SECRET)
    API->>API: Set req.user = { id: userId }
    API-->>App: Response data

    Note over App,API: Token Refresh

    App->>API: POST /api/auth/refresh-token { refreshToken }
    API->>DB: Find session by SHA-256(refreshToken)
    API->>API: Validate expiry, family
    API->>DB: Rotate: new refreshTokenHash, new accessToken
    API-->>App: { accessToken, refreshToken }
```

### Access Token Claims

```json
{
  "id": "uuid-of-user",
  "iat": 1708000000,
  "exp": 1708000900
}
```

### Token Pair Issuance

On every signin or refresh, `issueTokenPair()` in `tokenUtils.mjs`:

1. Generates a new access token (JWT, 15m expiry)
2. Generates a new refresh token (64-char random hex)
3. SHA-256 hashes the refresh token for secure DB storage
4. Creates or updates `LoginSession` with device info, IP, user agent
5. Returns both tokens to the client

## Token Rotation

Each refresh token belongs to a **token family** (UUID). This enables detection of token reuse (theft):

```text
Normal flow:
  RT-1 → rotate → RT-2 → rotate → RT-3  (same family)

Reuse attack detected:
  RT-1 → rotate → RT-2 (legitimate)
  RT-1 → rotate → BLOCKED (RT-1 already used → invalidate entire family)
```

When reuse is detected, all sessions in that token family are invalidated, forcing re-authentication.

## Two-Factor Authentication

### Enable 2FA

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as Backend
    participant Email as SMTP

    App->>API: PUT /api/auth/two-factor { enabled: true }
    API->>API: Generate 6-digit OTP
    API->>API: SHA-256 hash OTP
    API->>Email: Send OTP email
    API-->>App: { message: "Verification code sent" }

    App->>API: POST /api/auth/two-factor/verify { code: "123456" }
    API->>API: SHA-256(input) === stored hash?
    API->>API: Check expiry (10 minutes)
    alt Match
        API-->>App: { message: "2FA enabled" }
    else Wrong Code
        API->>API: Increment attempts (max 5)
        API-->>App: 400 error
    end
```

### Brute-Force Protection

| Parameter | Value |
|-----------|-------|
| Max attempts | 5 |
| Lockout duration | 15 minutes |
| Code expiry | 10 minutes |
| Lockout field | `twoFactorLockedUntil` |
| Attempt counter | `twoFactorAttempts` (reset on success) |

### Login with 2FA

1. User submits email + password → `POST /api/auth/signin`
2. Server validates credentials, sees `twoFactorEnabled: true`
3. Returns `{ requires2FA: true }` (no tokens yet)
4. Client shows OTP input screen
5. User enters code → `POST /api/auth/two-factor/verify-login`
6. Server validates OTP → issues token pair

## Password Reset

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as Backend
    participant Email as SMTP

    App->>API: POST /api/auth/forgot-password { email }
    API->>API: Generate reset token
    API->>API: SHA-256 hash for DB storage
    API->>Email: Send reset link (1-hour expiry)
    API-->>App: { message: "Reset email sent" }

    Note over App: User clicks link in email

    App->>API: POST /api/auth/validate-reset-token { token }
    API->>API: SHA-256(token) matches DB?
    API->>API: Check expiry
    API-->>App: { valid: true }

    App->>API: POST /api/auth/reset-password { token, newPassword }
    API->>API: Validate token again
    API->>API: bcrypt hash new password
    API->>API: Clear reset token fields
    API-->>App: { message: "Password reset successful" }
```

## Session Management

### LoginSession Tracking

Every token pair issuance creates a `LoginSession` record with:

- Device info (platform, browser, OS parsed from User-Agent)
- IP address
- Location (if available)
- Login time, last activity
- Active status

### Multi-Device Operations

| Endpoint | Description |
|----------|-------------|
| `GET /api/users/login-activity` | List all sessions |
| `POST /api/users/sessions/:sessionId/revoke` | Revoke specific session |
| `POST /api/users/signout-all-devices` | Mark all sessions inactive |
| `POST /api/auth/signout` | Mark current session inactive |

## Middleware Reference

### `verifyToken`

**File:** `server/utils/verifyUser.mjs`

Extracts and verifies JWT from the `Authorization: Bearer <token>` header. Sets `req.user = { id }`.

| Scenario | Response |
|----------|----------|
| No header | 401 "You are not authenticated" |
| Expired token | 401 "Token expired" |
| Invalid/tampered | 403 "Token is not valid" |

### `requireRole(...roles)`

Checks `AppUser.role` from the database. Returns 403 if user's role is not in the allowed list.

```javascript
// Usage in routes
router.get('/admin/pending', verifyToken, requireModerator, getPendingAds);
router.delete('/cleanup', verifyToken, requireAdmin, cleanupNotifications);
```

### `optionalAuth`

Same as `verifyToken` but continues as anonymous (no `req.user`) if token is missing or invalid. Used for endpoints that enhance responses for authenticated users:

```javascript
// GET /api/videos/all — shows isLiked/isBookmarked if authenticated
router.get('/all', optionalAuth, getAllVideos);
```
