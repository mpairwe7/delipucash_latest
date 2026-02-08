# DelipuCash

A comprehensive mobile rewards and survey platform that allows users to earn money by participating in quizzes, surveys, watching videos, and viewing advertisements.

## 📱 Overview

DelipuCash is a full-stack mobile application built with React Native (Expo) for the frontend and Node.js/Express for the backend. Users can earn points through various activities and redeem them for cash via mobile money (MTN, Airtel).

## 🏗️ Project Structure

```
DelipuCash-Latest/
├── DelipuCash/          # React Native (Expo) Mobile App
│   ├── app/             # App screens (file-based routing)
│   ├── components/      # Reusable UI components
│   ├── services/        # API services and hooks
│   ├── store/           # State management (Zustand)
│   ├── hooks/           # Custom React hooks
│   └── ...
│
└── server/              # Node.js/Express Backend
    ├── controllers/     # Route handlers
    ├── routes/          # API route definitions
    ├── prisma/          # Database schema & migrations
    ├── lib/             # Prisma client & utilities
    └── ...
```

## ✨ Features

### For Users
- 📝 **Quiz Sessions** - Answer questions to earn points
- 📊 **Surveys** - Participate in surveys for rewards
- 🎥 **Videos** - Watch videos and earn rewards
- 📺 **Advertisements** - View targeted ads for points
- 💰 **Instant Rewards** - Win cash prizes instantly
- 💳 **Mobile Money** - Redeem points via MTN/Airtel
- 🔔 **Notifications** - Real-time push notifications
- 👤 **User Profiles** - Manage account settings

### For Advertisers
- 🎯 **Targeted Ads** - Age, gender, location targeting
- 📈 **Analytics** - Track impressions, clicks, conversions
- 💵 **Budget Control** - CPM, CPC, CPA pricing models
- 📅 **Campaign Management** - Schedule and manage campaigns

### For Admins
- 👥 **User Management** - Manage users and roles
- ❓ **Content Management** - Create questions and surveys
- 💰 **Payment Management** - Process disbursements
- 📊 **Dashboard** - Analytics and reporting

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun 1.x
- PostgreSQL database (Supabase recommended)
- Expo CLI
- iOS Simulator / Android Emulator / Physical device

### Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
bunx prisma generate

# Push database schema
bunx prisma db push

# Seed database (creates admin user)
node prisma/seed.mjs

# Start development server
VERCEL=0 bun run dev
```

### Frontend Setup

```bash
# Navigate to mobile app directory
cd DelipuCash

# Install dependencies
bun install

# Start Expo development server
npx expo start
eas build --platform android --profile production --local
```

### Default Admin Credentials

After seeding the database:
- **Email:** admin@delipucash.com
- **Password:** admin123456

## 🛠️ Tech Stack

### Frontend (Mobile App)
| Technology | Purpose |
|------------|---------|
| React Native | Mobile framework |
| Expo | Development platform |
| Expo Router | File-based navigation |
| Zustand | State management |
| TanStack Query | Data fetching & caching |
| NativeWind | Tailwind CSS for React Native |

### Backend (Server)
| Technology | Purpose |
|------------|---------|
| Node.js / Bun | Runtime |
| Express.js | Web framework |
| Prisma 7.x | ORM |
| PostgreSQL | Database |
| Prisma Accelerate | Query caching |
| JWT | Authentication |
| Vercel | Deployment |

## 📚 Documentation

- [Backend Setup Guide](./server/README.md)
- [Mobile App Setup Guide](./DelipuCash/README.md)
- [Google Play Billing](./DelipuCash/docs/GOOGLE_PLAY_BILLING.md)

## 🔧 Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."
ACCELERATE_URL="prisma+postgres://..."
JWT_SECRET="your-secret"
PORT=3000
```

### Frontend
Configure in `app.json` or create `.env`:
```env
EXPO_PUBLIC_API_URL="http://localhost:3000/api"
```

## 📱 Running on Devices

### iOS Simulator
```bash
npx expo run:ios
```

### Android Emulator
```bash
npx expo run:android
```

### Physical Device
1. Install Expo Go app
2. Scan QR code from `npx expo start`

## 🧪 Testing

### Backend
```bash
cd server
bun run test
```

### Frontend
```bash
cd DelipuCash
bun run test
```

## 🚀 Deployment

### Backend (Vercel)
```bash
cd server
vercel --prod
```

### Frontend (EAS Build)
```bash
cd DelipuCash
eas build --platform all
eas submit --platform all
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@delipucash.com or join our Discord community.
