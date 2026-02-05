# DelipuCash Mobile App

A React Native (Expo) mobile application for the DelipuCash rewards platform. Users can earn money by participating in quizzes, surveys, watching videos, and viewing advertisements.

## 🚀 Tech Stack

- **Framework:** React Native with Expo SDK 52
- **Navigation:** Expo Router (file-based routing)
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Styling:** NativeWind (Tailwind CSS)
- **Build:** EAS Build

## 📋 Prerequisites

- Node.js 18+ or Bun 1.x
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator
- Expo Go app (for physical device testing)

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd DelipuCash
bun install
# or
npm install
```

### 2. Configure Environment

Create a `.env` file or configure in `app.json`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For production, update the API URL to your deployed backend.

### 3. Start Development Server

```bash
npx expo start
```

Options:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app

## 📁 Project Structure

```
DelipuCash/
├── app/                    # Screens (file-based routing)
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/            # Main tab navigation
│   │   ├── index.tsx      # Home
│   │   ├── explore.tsx    # Explore
│   │   ├── rewards.tsx    # Rewards
│   │   └── profile.tsx    # Profile
│   ├── question/          # Question screens
│   ├── survey/            # Survey screens
│   ├── quiz-session.tsx   # Quiz gameplay
│   ├── subscription.tsx   # Subscription management
│   └── _layout.tsx        # Root layout
│
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   ├── cards/            # Card components
│   ├── quiz/             # Quiz-related components
│   ├── ads/              # Advertisement components
│   ├── notifications/    # Notification components
│   └── ...
│
├── services/             # API & data services
│   ├── api.ts           # Base API client
│   ├── hooks.ts         # React Query hooks
│   ├── adApi.ts         # Advertisement API
│   ├── surveyApi.ts     # Survey API
│   ├── questionApi.ts   # Question API
│   └── ...
│
├── store/               # Zustand stores
│   ├── index.ts        # Main store exports
│   ├── AuthStore.ts    # Authentication state
│   ├── AdStore.ts      # Advertisement state
│   └── ...
│
├── hooks/              # Custom React hooks
│   ├── useCamera.ts
│   ├── useSearch.ts
│   └── ...
│
├── constants/          # App constants
│   ├── theme.ts       # Theme configuration
│   └── mockData.ts    # Mock data for development
│
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── assets/            # Images, fonts, etc.
│
├── app.json          # Expo configuration
├── eas.json          # EAS Build configuration
└── package.json
```

## 📱 Key Features

### Authentication
- Email/password login and registration
- JWT token-based authentication
- Persistent sessions
- Password recovery

### Quiz System
- Multiple choice questions
- Timer-based quizzes
- Points calculation
- Progress tracking

### Surveys
- Dynamic form generation
- Multiple question types (text, radio, checkbox, rating)
- Response submission
- Survey history

### Advertisements
- Native ad integration
- Targeted ad delivery
- Ad impression/click tracking
- Rewarded video ads

### Rewards & Payments
- Points balance tracking
- Reward redemption
- Mobile money integration (MTN, Airtel)
- Transaction history

### Notifications
- Push notifications
- In-app notifications
- Notification preferences

## 🔍 Navigation Structure

```
Root Layout (_layout.tsx)
├── (auth)                  # Unauthenticated routes
│   ├── login
│   └── register
│
├── (tabs)                  # Main tab navigation
│   ├── index (Home)
│   ├── explore
│   ├── rewards
│   └── profile
│
├── quiz-session           # Quiz gameplay
├── question/[id]          # Question detail
├── survey/[id]            # Survey detail
├── subscription           # Subscription management
├── notifications-screen   # Notifications list
└── help-support          # Help & support
```

## 🎨 Styling

Using NativeWind (Tailwind CSS for React Native):

```tsx
import { View, Text } from 'react-native';

export function MyComponent() {
  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-lg font-bold text-gray-900">
        Hello World
      </Text>
    </View>
  );
}
```

## 📊 State Management

Using Zustand for global state:

```tsx
import { useAuthStore } from '@/store';

function MyComponent() {
  const { user, login, logout } = useAuthStore();
  
  // Use state and actions
}
```

## 🔗 API Integration

Using TanStack Query for data fetching:

```tsx
import { useQuestions } from '@/services/hooks';

function QuestionsScreen() {
  const { data, isLoading, error } = useQuestions();
  
  if (isLoading) return <Loading />;
  if (error) return <Error />;
  
  return <QuestionList data={data} />;
}
```

## 🏗️ Building for Production

### EAS Build Setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

### Build Commands

```bash
# Development build
eas build --profile development --platform all

# Preview build
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all
```

### Submit to App Stores

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

## 🐛 Troubleshooting

### Metro Bundler Issues
```bash
# Clear cache and restart
npx expo start --clear
```

### Native Module Issues
```bash
# Rebuild native code
npx expo prebuild --clean
```

### Dependency Issues
```bash
# Check for issues
npx expo-doctor
```

## 📝 Available Scripts

```bash
# Start development server
npx expo start

# Start with cache cleared
npx expo start --clear

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android

# Run linter
bun run lint

# Run tests
bun run test

# Generate native projects
npx expo prebuild
```

## 🔒 Security

- Secure token storage using Expo SecureStore
- API request authentication
- Input validation
- Sensitive data protection

## 📱 Supported Platforms

- iOS 13+
- Android API 21+ (Android 5.0)

# Check current firewall status
sudo firewall-cmd --state

# Allow TCP port 8081 (Metro bundler)
sudo firewall-cmd --permanent --add-port=8081/tcp

# Reload firewall to apply changes
sudo firewall-cmd --reload

# Verify the port is open
sudo firewall-cmd --list-ports

## 📚 Additional Documentation

- [Google Play Billing Setup](./docs/GOOGLE_PLAY_BILLING.md)

## 📝 License

MIT License - see LICENSE file for details
