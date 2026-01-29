# DelipuCash Backend Server

A robust Node.js/Express backend API for the DelipuCash mobile application, featuring Prisma ORM with PostgreSQL and Prisma Accelerate for enhanced performance.

## 🚀 Tech Stack

- **Runtime:** Node.js 18+ / Bun
- **Framework:** Express.js
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma 7.x with Prisma Accelerate
- **Authentication:** JWT (JSON Web Tokens)
- **Deployment:** Vercel Serverless Functions

## 📋 Prerequisites

- Node.js 18.x or higher (or Bun 1.x)
- PostgreSQL database (Supabase recommended)
- Prisma Accelerate account (for caching)
- Environment variables configured

## 🛠️ Local Development Setup

### 1. Clone and Install Dependencies

```bash
cd server
bun install
# or
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database URLs
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://user:password@host:5432/postgres"
ACCELERATE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_KEY"

# Authentication
JWT_SECRET="your-secure-jwt-secret"

# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:8081"
```

### 3. Database Setup

Generate Prisma client:

```bash
bunx prisma generate
```

Push schema to database:

```bash
bunx prisma db push
```

Seed the database with default admin user:

```bash
node prisma/seed.mjs
```

**Default Admin Credentials:**
- Email: `admin@delipucash.com`
- Password: `admin123456`

### 4. Start Development Server

```bash
# Using Bun
VERCEL=0 bun run dev

# Using npm
VERCEL=0 npm run dev
```

The server will start at `http://localhost:3000`

## 📁 Project Structure

```
server/
├── api/
│   └── index.js              # Vercel serverless entry point
├── controllers/              # Route handlers
│   ├── auth.controller.mjs   # Authentication logic
│   ├── AdController.mjs      # Advertisement management
│   ├── questionController.mjs
│   ├── surveyController.mjs
│   ├── paymentController.mjs
│   └── ...
├── routes/                   # API route definitions
│   ├── auth.route.mjs
│   ├── AdRoutes.mjs
│   ├── questionRoutes.mjs
│   └── ...
├── lib/
│   └── prisma.mjs           # Prisma client singleton
├── config/
│   ├── corsOptions.mjs      # CORS configuration
│   └── db.mjs               # Database configuration
├── utils/
│   ├── verifyUser.mjs       # JWT verification middleware
│   ├── adminInit.mjs        # Admin user initialization
│   └── error.mjs            # Error handling utilities
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.mjs             # Database seeding script
├── index.js                 # Local development entry point
├── vercel.json              # Vercel deployment config
└── package.json
```

## 🔍 API Endpoints

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health check |
| GET | `/api/health/ping` | Simple ping |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/profile` | Get user profile |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users (Admin) |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Questions & Quiz
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions` | Get all questions |
| POST | `/api/questions` | Create question |
| GET | `/api/quiz/questions` | Get quiz questions |
| POST | `/api/quiz/sessions` | Save quiz session |
| GET | `/api/quiz/points/:userId` | Get user points |
| PUT | `/api/quiz/points` | Update user points |

### Surveys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/surveys` | Get all surveys |
| POST | `/api/surveys` | Create survey |
| GET | `/api/surveys/:id` | Get survey by ID |
| POST | `/api/surveys/:id/respond` | Submit survey response |

### Advertisements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ads` | Get ads with targeting |
| POST | `/api/ads` | Create advertisement |
| GET | `/api/ads/:id` | Get ad by ID |
| POST | `/api/ads/:id/click` | Track ad click |
| POST | `/api/ads/:id/impression` | Track ad impression |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/initiate` | Initiate payment |
| POST | `/api/payments/callback` | Payment callback |
| GET | `/api/payments/history` | Payment history |

### Rewards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rewards` | Get user rewards |
| POST | `/api/rewards/redeem` | Redeem reward |
| GET | `/api/reward-questions` | Get reward questions |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get notifications |
| PUT | `/api/notifications/:id/read` | Mark as read |
| DELETE | `/api/notifications/:id` | Delete notification |

## 🗄️ Database Schema

Key models in the Prisma schema:

- **AppUser** - User accounts with roles (USER, ADMIN, MODERATOR)
- **Question** - Quiz questions
- **QuestionAttempt** - User question attempts
- **Survey** - Survey definitions
- **SurveyResponse** - Survey responses
- **Ad** - Advertisements with targeting options
- **Payment** - Payment transactions
- **Reward** - User rewards
- **RewardQuestion** - Instant reward questions
- **Notification** - Push notifications
- **Video** - Video content

## 🚀 Deployment

### Vercel Deployment

1. **Connect Repository:**
   - Link your GitHub repository to Vercel
   - Set the root directory to `server`

2. **Configure Environment Variables:**
   Add all required environment variables in Vercel dashboard.

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### Manual Deployment

```bash
chmod +x deploy.sh
./deploy.sh
```

## 🔧 Available Scripts

```bash
# Development
bun run dev          # Start development server with nodemon

# Production
bun run start        # Start production server
bun run build        # Generate Prisma client

# Database
bun run db:push      # Push schema to database
bun run db:studio    # Open Prisma Studio
bun run db:reset     # Reset database
bun run db:seed      # Seed database

# Testing
bun run test         # Run tests
```

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- CORS configuration
- Input validation
- Rate limiting (recommended for production)

## 🐛 Troubleshooting

### Database Connection Issues

1. Verify `DATABASE_URL` and `DIRECT_DATABASE_URL` are correct
2. Check if Prisma Accelerate API key is valid
3. Ensure database is accessible from your network

### Prisma Client Issues

```bash
# Regenerate Prisma client
bunx prisma generate

# Reset and resync database
bunx prisma db push --force-reset
```

### Admin User Creation

If the admin user is not created automatically:

```bash
node prisma/seed.mjs
```

## 📝 License

MIT License - see LICENSE file for details
