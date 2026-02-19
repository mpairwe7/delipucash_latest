# Screen Inventory

All 41 screens organized by feature area.

## Tab Screens

| Screen | Route | Description |
|--------|-------|-------------|
| home-redesigned | `/(tabs)/home-redesigned` | Dashboard with personalized header, wallet preview, quick actions, daily rewards, earning opportunities |
| questions-new | `/(tabs)/questions-new` | Q&A feed with tabs (for-you, trending, recent), gamification, infinite scroll, in-feed ads |
| videos-new | `/(tabs)/videos-new` | TikTok/Reels vertical video feed with data saver, livestream, search, interstitial ads |
| surveys-new | `/(tabs)/surveys-new` | Survey discovery and listing |
| profile-new | `/(tabs)/profile-new` | User profile with earnings, settings, achievements, transactions |
| transactions | `/(tabs)/transactions` | Transaction history (hidden tab) |
| withdraw | `/(tabs)/withdraw` | Withdrawal/redemption interface (hidden tab) |
| explore | `/(tabs)/explore` | Content discovery (hidden tab) |

## Auth Screens

| Screen | Route | Description |
|--------|-------|-------------|
| login | `/(auth)/login` | Email/password authentication |
| signup | `/(auth)/signup` | User registration |
| forgot-password | `/(auth)/forgot-password` | Password recovery request |
| reset-password | `/(auth)/reset-password` | Password reset (deep link enabled) |

## Question Screens

| Screen | Route | Description |
|--------|-------|-------------|
| question/[id] | `/question/:id` | Question detail with responses, voting |
| question-detail | `/question-detail` | Enhanced question detail (shared layout) |
| question-answer/[id] | `/question-answer/:id` | Answer submission interface |

## Survey Screens

| Screen | Route | Description |
|--------|-------|-------------|
| survey/[id] | `/survey/:id` | Survey form/questionnaire with multiple question types |
| survey-responses/[id] | `/survey-responses/:id` | Survey response analytics and detail view |
| survey-payment | `/survey-payment` | Survey subscription payment management |
| create-survey | `/create-survey` | Multi-step survey builder/creator |

## Reward Question Screens

| Screen | Route | Description |
|--------|-------|-------------|
| reward-questions | `/reward-questions` | Regular reward question listing (Available/Attempted tabs) |
| reward-question/[id] | `/reward-question/:id` | Answer regular reward question, session summary, redemption |
| instant-reward-questions | `/instant-reward-questions` | Instant reward questions listing with wallet sync from server points |
| instant-reward-answer/[id] | `/instant-reward-answer/:id` | Answer instant reward question with animated feedback, progress bar, optimistic answer locking, submit debounce guard |
| instant-reward-upload | `/instant-reward-upload` | Upload instant reward answers (MTN/Airtel only) |

## Quiz Screens

| Screen | Route | Description |
|--------|-------|-------------|
| quiz-session | `/quiz-session` | Quiz gameplay with timer, streak, answer validation |

## Utility Screens

| Screen | Route | Description |
|--------|-------|-------------|
| notifications | `/notifications` | Notifications center |
| notifications-screen | `/notifications-screen` | Notifications list with deep linking |
| subscription | `/subscription` | Premium subscription management |
| help-support | `/help-support` | Help and support interface |
| ad-registration | `/ad-registration` | Ad campaign creation for advertisers |
| leaderboard | `/leaderboard` | User rankings |
| file-upload | `/file-upload` | File upload utility |
| api-test | `/api-test` | Development API testing (dev only) |

## Entry Screens

| Screen | Route | Description |
|--------|-------|-------------|
| index | `/` | Splash/welcome with feature intro and CTAs |
| welcome | `/welcome` | Feature showcase |
| modal | `/modal` | Generic modal handler |
| +not-found | N/A | 404 fallback screen |
