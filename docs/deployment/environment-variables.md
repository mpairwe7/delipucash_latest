# Environment Variables

Complete reference for all environment variables used across the DelipuCash backend and frontend.

## Table of Contents

- [Backend Variables](#backend-variables)
- [Frontend Variables](#frontend-variables)
- [Where to Set Variables](#where-to-set-variables)
- [Local Development](#local-development)

## Backend Variables

**File:** `server/.env` (local) or Vercel Dashboard (production)

### Database

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db?pgbouncer=true` | PostgreSQL connection string (pooled) |
| `DIRECT_DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` | Direct connection (for migrations) |

> The pooled URL (`DATABASE_URL`) routes through PgBouncer for connection pooling. The direct URL (`DIRECT_DATABASE_URL`) bypasses pooling and is required for `prisma migrate deploy`.

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | Environment (`development`, `production`) |
| `FRONTEND_URL` | Yes | `https://your-frontend.vercel.app` | CORS allowed origin |

### Authentication

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | `your-256-bit-secret` | Secret key for signing JWTs |
| `JWT_EXPIRES_IN` | No | `7d` | Access token expiry duration |

### Email (SMTP)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `EMAIL_USER` | Yes | `noreply@delipucash.com` | SMTP sender email |
| `EMAIL_PASS` | Yes | `app-password-here` | SMTP password or app password |

Used for: password reset emails, 2FA OTP codes, notification emails.

### Cloudflare R2 Storage

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Yes | `abc123...` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | `r2-key-id` | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Yes | `r2-secret` | R2 S3-compatible secret key |
| `R2_BUCKET_NAME` | Yes | `delipucash-media` | R2 bucket name |
| `R2_PUBLIC_URL` | Yes | `https://cdn.delipucash.com` | Public URL for R2 bucket (custom domain or `r2.dev` URL) |

### Payment Providers — PayPal (Legacy)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `PAYPAL_CLIENT_ID` | No | `client-id` | PayPal client ID (legacy, not actively used) |
| `PAYPAL_CLIENT_SECRET` | No | `client-secret` | PayPal client secret |

### MTN Mobile Money

Config module: `server/lib/mtnConfig.mjs`

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `MTN_USER_ID` | Yes | `624637e4-7569-...` | MTN API User UUID (created via provisioning) |
| `MTN_API_KEY` | Yes | `2b01818f9f6c40dc...` | MTN API Key (Basic Auth password) |
| `MTN_PRIMARY_KEY` | Yes | `0b28ba83f5d5...` | Collection subscription key (`Ocp-Apim-Subscription-Key`) |
| `MTN_DISBURSEMENT_KEY` | No | `fff5ced1a366...` | Disbursement subscription key (falls back to `MTN_PRIMARY_KEY`) |
| `X_TARGET_ENVIRONMENT` | No | `sandbox` | Target environment: `sandbox` (default) or `production` |
| `MTN_BASE_URL` | No | `https://proxy.momoapi.mtn.com` | Override base URL (auto-detected from `X_TARGET_ENVIRONMENT`) |
| `MTN_CALLBACK_URL` | Prod | `https://yourdomain.com/api/payments/callback` | HTTPS callback URL for async payment notifications (production only — callbacks don't work in sandbox) |

> **Sandbox note:** In sandbox, currency is automatically converted from UGX to EUR. Set `X_TARGET_ENVIRONMENT=sandbox` (default) and use the sandbox base URL.

### Airtel Money

Config module: `server/lib/airtelConfig.mjs`

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `AIRTEL_CLIENT_ID` | Yes | `1408e94b-587d-...` | OAuth client ID |
| `AIRTEL_CLIENT_SECRET` | Yes | `**********` | OAuth client secret |
| `AIRTEL_PIN` | Yes | `1234` | Airtel merchant PIN |
| `AIRTEL_CALLBACK_URL` | No | `https://yourdomain.com/api/payments/callback` | Callback URL for async notifications |
| `AIRTEL_COUNTRY` | No | `UG` | Country code (default: `UG`) |
| `AIRTEL_CURRENCY` | No | `UGX` | Currency code (default: `UGX`) |
| `AIRTEL_MSISDN_FORMAT` | No | `E164_NO_PLUS` | Phone format: `E164_NO_PLUS` (default, `2567XXXXXXXX`) or `LOCAL` (`7XXXXXXXX`) |
| `AIRTEL_BASE_URL` | No | `https://openapi.airtel.africa` | Override base URL (auto-detected: sandbox → `openapiuat.airtel.africa`, prod → `openapi.airtel.africa`) |

### Callback Security

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `CALLBACK_SECRET` | Prod | `a3f8c1...` (64 hex chars) | HMAC-SHA256 key for verifying MTN/Airtel webhook callbacks. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> **Security:** In production, always set `CALLBACK_SECRET`. Without it, callback signature verification is skipped (a warning is logged). The callback endpoint uses HMAC-SHA256 with replay protection (5-minute window) instead of JWT auth.

## Frontend Variables

**File:** `DelipuCash/.env` (local) or EAS Secrets (production builds)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | `https://delipucash-latest.vercel.app` | Backend API base URL |

> Only variables prefixed with `EXPO_PUBLIC_` are available in the client bundle. Never expose secrets in `EXPO_PUBLIC_*` variables.

### Build-Time Only

These are set in `eas.json` and only affect the build process:

| Variable | Profile | Value | Description |
|----------|---------|-------|-------------|
| `NODE_ENV` | development | `development` | Enables dev tools |
| `NODE_ENV` | preview, production | `production` | Optimized builds |
| `GRADLE_OPTS` | production | `-Xmx4096m -XX:MaxMetaspaceSize=512m` | Android Gradle heap size |

## Where to Set Variables

### Backend (Vercel)

1. Go to the [Vercel Dashboard](https://vercel.com)
2. Select the `delipucash-latest` project
3. Navigate to **Settings** → **Environment Variables**
4. Add each variable for the appropriate environment (Production, Preview, Development)

```bash
# Or via Vercel CLI
vercel env add DATABASE_URL production
```

### Frontend (EAS)

For secrets that shouldn't be in `eas.json`:

```bash
# Create an EAS secret
eas secret:create --name EXPO_PUBLIC_API_URL --value "https://delipucash-latest.vercel.app" --scope project
```

For non-sensitive values, use the `env` block in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://delipucash-latest.vercel.app"
      }
    }
  }
}
```

## Local Development

### Backend

Create `server/.env` from the template:

```bash
cp server/.env.example server/.env
```

Then fill in all required values. See [Backend Setup](../backend/README.md) for detailed instructions.

### Frontend

Create `DelipuCash/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

For connecting to the production API during local development:

```env
EXPO_PUBLIC_API_URL=https://delipucash-latest.vercel.app
```

### Security Notes

- Never commit `.env` files — they are in `.gitignore`
- Use `server/.env.example` as the template (committed, no real secrets)
- Rotate `JWT_SECRET` periodically in production
- Use app-specific passwords for SMTP (not your account password)
- R2 keys should have minimal permissions (read/write to the specific bucket only)
