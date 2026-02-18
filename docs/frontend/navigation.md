# Navigation & Routing

## Overview

DelipuCash uses Expo Router 6 for file-based routing. Every `.tsx` file in `app/` becomes a route. The app supports deep linking via iOS Universal Links and Android App Links.

## Route Tree

```text
app/
├── _layout.tsx                           # Root layout (providers)
├── index.tsx                             # / — Splash/welcome
├── welcome.tsx                           # /welcome
├── modal.tsx                             # /modal
├── +not-found.tsx                        # 404 fallback
│
├── (auth)/                               # Auth group (no tab bar)
│   ├── _layout.tsx                       # Auth layout
│   ├── login.tsx                         # /login
│   ├── signup.tsx                        # /signup
│   ├── forgot-password.tsx               # /forgot-password
│   └── reset-password.tsx                # /reset-password (deep link)
│
├── (tabs)/                               # Main tab navigator
│   ├── _layout.tsx                       # Tab bar config
│   ├── home-redesigned.tsx               # Tab: Home
│   ├── questions-new.tsx                 # Tab: Questions
│   ├── videos-new.tsx                    # Tab: Videos
│   ├── surveys-new.tsx                   # Tab: Surveys
│   ├── profile-new.tsx                   # Tab: Profile
│   ├── transactions.tsx                  # Hidden tab: Transactions
│   ├── withdraw.tsx                      # Hidden tab: Withdraw
│   └── explore.tsx                       # Hidden tab: Explore
│
├── question/[id].tsx                     # /question/:id
├── question-detail.tsx                   # /question-detail
├── question-answer/[id].tsx              # /question-answer/:id
│
├── survey/[id].tsx                       # /survey/:id
├── survey-responses/[id].tsx             # /survey-responses/:id
├── survey-payment.tsx                    # /survey-payment
├── create-survey.tsx                     # /create-survey
│
├── reward-questions.tsx                  # /reward-questions
├── reward-question/[id].tsx              # /reward-question/:id
├── instant-reward-questions.tsx          # /instant-reward-questions
├── instant-reward-answer/[id].tsx        # /instant-reward-answer/:id
├── instant-reward-upload.tsx             # /instant-reward-upload
│
├── quiz-session.tsx                      # /quiz-session
├── notifications.tsx                     # /notifications
├── notifications-screen.tsx              # /notifications-screen
├── subscription.tsx                      # /subscription
├── help-support.tsx                      # /help-support
├── ad-registration.tsx                   # /ad-registration
├── leaderboard.tsx                       # /leaderboard
├── file-upload.tsx                       # /file-upload
└── api-test.tsx                          # /api-test (dev only)
```

## Tab Configuration

The tab bar shows 5 primary tabs:

| Tab | Screen | Icon | Label |
|-----|--------|------|-------|
| 1 | home-redesigned | Home | Home |
| 2 | questions-new | HelpCircle | Questions |
| 3 | videos-new | Play | Videos |
| 4 | surveys-new | ClipboardList | Surveys |
| 5 | profile-new | User | Profile |

Hidden tabs (accessible via navigation but not shown in tab bar): `transactions`, `withdraw`, `explore`.

## Root Layout (`_layout.tsx`)

The root layout wraps the entire app with providers:

```text
GestureHandlerRootView
  └── PersistQueryClientProvider (TanStack Query + AsyncStorage persistence)
      └── ToastProvider (sonner-native)
          └── SSEProvider (real-time events)
              └── NotificationProvider (push notifications)
                  └── Slot (renders current route)
```

### Initialization

On mount, the root layout:

1. Loads fonts (Roboto: Regular, Medium, Bold)
2. Initializes auth state from SecureStore
3. Sets up network connectivity listener
4. Starts offline queue processor
5. Starts upload queue processor
6. Hides splash screen when ready

## Auth Flow

```mermaid
graph TD
    A[App Opens] --> B{Auth Ready?}
    B -->|No| C[Show Splash]
    B -->|Yes| D{Authenticated?}
    D -->|No| E[Show index.tsx / Welcome]
    D -->|Yes| F[Show tabs/home]
    E --> G{User Action}
    G -->|Login| H[(auth)/login]
    G -->|Signup| I[(auth)/signup]
    H --> J{Success?}
    J -->|Yes| F
    J -->|2FA Required| K[2FA Verification]
    K --> F
```

Protected screens redirect to login if unauthenticated:

```typescript
if (!isAuthenticated) {
  router.push('/(auth)/login');
  return;
}
```

## Deep Linking

### Configuration (`app.json`)

```json
{
  "scheme": "delipucash",
  "ios": {
    "associatedDomains": ["applinks:delipucashserver.vercel.app"]
  },
  "android": {
    "intentFilters": [{
      "action": "VIEW",
      "data": [{ "scheme": "https", "host": "delipucashserver.vercel.app", "pathPrefix": "/reset-password" }]
    }]
  }
}
```

### Supported Deep Links

| URL | Route | Purpose |
|-----|-------|---------|
| `delipucash://` | `/` | App open |
| `https://delipucashserver.vercel.app/reset-password?token=...` | `/(auth)/reset-password` | Password reset |

### Apple App Site Association

The backend serves `/.well-known/apple-app-site-association` for iOS Universal Links.

### Android Asset Links

The backend serves `/.well-known/assetlinks.json` for Android App Links.

## Navigation Patterns

### Push to Screen

```typescript
import { router } from 'expo-router';

// Navigate to question detail
router.push(`/question/${questionId}`);

// Navigate with params
router.push({ pathname: '/survey/[id]', params: { id: surveyId } });
```

### Dynamic Routes

Files with `[param]` in their name receive route parameters:

```typescript
// app/question/[id].tsx
import { useLocalSearchParams } from 'expo-router';

export default function QuestionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Use id to fetch question data
}
```

### Typed Routes

With `experiments.typedRoutes: true` in `app.json`, all route references are type-checked at compile time.
