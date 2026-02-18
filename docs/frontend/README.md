# Frontend Documentation

The DelipuCash frontend is a React Native + Expo application with 41 screens, 141 components, and 15 Zustand stores. It uses file-based routing (Expo Router), TanStack Query for server state, and Reanimated for native-thread animations.

## Directory Structure

```text
DelipuCash/
├── app/                          # Screens (Expo Router file-based routing)
│   ├── _layout.tsx               # Root layout (providers, auth, SSE)
│   ├── index.tsx                 # Splash/welcome screen
│   ├── (auth)/                   # Auth screens (login, signup, etc.)
│   ├── (tabs)/                   # Tab navigator (5 visible + 3 hidden)
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── home-redesigned.tsx   # Dashboard
│   │   ├── questions-new.tsx     # Q&A feed
│   │   ├── videos-new.tsx        # TikTok-style video feed
│   │   ├── surveys-new.tsx       # Survey listing
│   │   └── profile-new.tsx       # User profile
│   ├── question/[id].tsx         # Question detail
│   ├── survey/[id].tsx           # Survey form
│   ├── reward-question/[id].tsx  # Reward question answer
│   ├── instant-reward-answer/[id].tsx  # Instant reward answer
│   └── ...                       # 30+ more screens
├── components/                   # Reusable UI (141 files)
│   ├── ui/                       # Base UI primitives
│   ├── cards/                    # Card components
│   ├── feed/                     # Feed items, tabs, gamification
│   ├── home/                     # Home screen sections
│   ├── video/                    # Video player, feed, comments
│   ├── livestream/               # Camera, recording, controls
│   ├── quiz/                     # Timer, options, feedback, overlay
│   ├── ads/                      # Ad variants, placement wrapper
│   ├── profile/                  # Profile cards, settings
│   ├── survey/                   # Form fields, submission
│   ├── notifications/            # Notification display
│   └── payment/                  # Payment cards
├── store/                        # Zustand stores (15 stores)
│   ├── QuestionUIStore.ts        # Question tab persistence
│   ├── VideoFeedStore.ts         # Video feed orchestration
│   ├── VideoStore.ts             # Upload, recording, livestream
│   ├── InstantRewardStore.ts     # Reward session, wallet, offline queue
│   ├── QuizStore.ts              # Quiz gameplay state
│   ├── AdUIStore.ts              # Ad preferences, local metrics
│   ├── SurveyAttemptStore.ts     # Survey draft, progress
│   ├── SurveyUIStore.ts          # Survey UI preferences
│   └── ...                       # 6 more stores
├── services/                     # API client & data hooks
│   ├── api.ts                    # REST client with token refresh
│   ├── videoHooks.ts             # Video TanStack Query hooks
│   ├── questionHooks.ts          # Question TanStack Query hooks
│   ├── adHooksRefactored.ts      # Ad hooks (consolidated)
│   ├── hooks.ts                  # Legacy hooks
│   ├── adFrequencyManager.ts     # Ad frequency capping singleton
│   ├── useSmartAdPlacement.ts    # Intelligent ad placement
│   ├── r2UploadService.ts        # R2 upload client
│   └── sse/                      # SSE manager & hooks
├── utils/                        # Utilities
│   ├── theme.ts                  # Design tokens & theme hook
│   ├── quiz-utils.ts             # Quiz logic helpers
│   ├── validation.ts             # Form validation
│   └── auth/                     # Auth state & hooks
├── hooks/                        # Custom React hooks
│   ├── useCamera.ts              # Camera recording
│   ├── useSearch.ts              # Search with debounce
│   ├── useSystemBars.ts          # Status/nav bar management
│   └── useOfflineQueueProcessor.ts  # Offline submission flush
├── types/                        # TypeScript definitions
│   └── index.ts                  # All enums, interfaces, types
└── assets/                       # Images & fonts
```

## Key Conventions

1. **File-based routing** — screens are `.tsx` files in `app/`, folder names become URL segments
2. **React.memo** — all list items and sub-components are memoized
3. **Individual selectors** — `useStore(s => s.action)` instead of destructuring (prevents full-store re-renders)
4. **Ref-mirrored state** — volatile values synced to refs via `useEffect` for stable callbacks
5. **Feature-specific hooks** — prefer `videoHooks.ts` over legacy `hooks.ts`
6. **IAB compliance** — ad viewability tracking follows IAB MRC standards

## Local Development

```bash
cd DelipuCash
npm install
echo "EXPO_PUBLIC_API_URL=http://localhost:3000" > .env
npx expo start
```

## Related Documentation

- [Navigation](navigation.md) — Route tree and deep linking
- [State Management](state-management.md) — Zustand + TanStack Query
- [Screens](screens.md) — All 41 screens
- [Components](components.md) — Component library
- [Services](services.md) — API client and hooks
- [Design System](theming.md) — Tokens, colors, typography
- [Performance](performance.md) — Optimization patterns
