# Getting Started

This guide walks you through setting up the DelipuCash development environment from scratch.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone the Repository](#clone-the-repository)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running Locally](#running-locally)
- [Default Credentials](#default-credentials)
- [First Steps](#first-steps)

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| Bun | 1.3+ | Backend runtime & package manager |
| PostgreSQL | 15+ | Database (or Supabase hosted) |
| Expo CLI | Latest | `npm install -g expo-cli` |
| EAS CLI | 16.31+ | `npm install -g eas-cli` (for builds) |
| Git | 2.40+ | Version control |

Optional:

- **Android Studio** — for Android emulator
- **Xcode 15+** — for iOS simulator (macOS only)
- **Expo Go** — for physical device testing

## Clone the Repository

```bash
git clone <repository-url> delipucash_latest
cd delipucash_latest
```

## Backend Setup

```bash
cd server

# Install dependencies
bun install

# Create environment file
cp .env.example .env
```

Edit `.env` with your values (see [Environment Variables](deployment/environment-variables.md) for the full list):

```env
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/delipucash"
DIRECT_DATABASE_URL="postgresql://user:pass@localhost:5432/delipucash"
JWT_SECRET="your-secret-key-min-32-chars"

# Optional (features degrade gracefully without these)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
CLOUDFLARE_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="delipucash"
```

### Database Setup

```bash
# Generate Prisma client
bun prisma generate

# Run migrations
bun prisma migrate dev

# Seed default admin user
bun run db:seed

# (Optional) Seed mock data for development
bun run seed:mock
```

### Verify Backend

```bash
bun run dev
# Server starts on http://localhost:3000

# Health check
curl http://localhost:3000/api/health
```

## Frontend Setup

```bash
cd DelipuCash

# Install dependencies
npm install
# or
bun install
```

Create `.env` in the `DelipuCash/` directory:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

> **Note:** For physical device testing, use your machine's local IP instead of `localhost` (e.g., `http://192.168.0.117:3000`).

## Running Locally

### Start Both Services

Terminal 1 — Backend:

```bash
cd server
bun run dev
```

Terminal 2 — Frontend:

```bash
cd DelipuCash
npx expo start
```

Then press:

- `a` — open on Android emulator
- `i` — open on iOS simulator
- `w` — open in web browser
- Scan QR code — open on physical device via Expo Go

### Using Expo Dev Client

For full native module support (camera, video, etc.), use a development build:

```bash
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

Install the resulting APK/IPA on your device, then run:

```bash
npx expo start --dev-client
```

## Default Credentials

On first database seed, a default admin account is created:

| Field | Value |
|-------|-------|
| Email | `admin@delipucash.com` |
| Password | `admin123456` |
| Role | ADMIN |
| Points | 100,000 |

> **Important:** Change the admin password immediately in production environments.

## First Steps

1. Start the backend and verify the health check responds
2. Start the Expo dev server and open the app
3. Sign up with a test account or log in as admin
4. Explore the tab screens: Home, Questions, Videos, Surveys, Profile
5. Try answering a reward question to see the payment flow
6. Check the [API Reference](backend/api-reference.md) for available endpoints
7. Review the [Architecture Overview](architecture/overview.md) for the big picture

## Troubleshooting

**Backend won't start:**

- Check that PostgreSQL is running and `DATABASE_URL` is correct
- Run `bun prisma migrate dev` if you see schema errors
- Ensure port 3000 is not in use

**Frontend connection errors:**

- Verify `EXPO_PUBLIC_API_URL` points to the running backend
- For physical devices, use your machine's LAN IP, not `localhost`
- Check CORS — your Expo URL must be in the allowed origins list

**Prisma errors after pulling new code:**

```bash
bun prisma generate   # Regenerate client
bun prisma migrate dev  # Apply new migrations
```

**Expo build errors:**

- Clear metro cache: `npx expo start --clear`
- Delete `node_modules` and reinstall
- For native module issues, rebuild with EAS: `eas build --profile development`
