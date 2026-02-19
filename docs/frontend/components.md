# Component Library

141 components organized by category. All list items and performance-critical components use `React.memo`.

## Table of Contents

- [UI Primitives](#ui-primitives)
- [Card Components](#card-components)
- [Feed Components](#feed-components)
- [Home Screen Components](#home-screen-components)
- [Video Components](#video-components)
- [Livestream Components](#livestream-components)
- [Quiz Components](#quiz-components)
- [Ad Components](#ad-components)
- [Profile Components](#profile-components)
- [Survey Components](#survey-components)
- [Notification Components](#notification-components)
- [Payment Components](#payment-components)

## UI Primitives

**Directory:** `components/ui/`

| Component | Purpose | Notes |
|-----------|---------|-------|
| ScreenWrapper | Safe area wrapper with insets | Base wrapper for all screens |
| PrimaryButton | CTA button | Variants: primary, secondary, ghost, danger |
| IconButton | Icon-only button | Configurable size and color |
| FormInput | Text input with validation | Shows error state |
| PhoneInput | Phone number input | Country code picker |
| Checkbox | Custom checkbox | Animated check mark |
| PasswordStrengthIndicator | Password validation | Shows strength levels |
| ProgressBar | Linear progress | Configurable color and height |
| FloatingActionButton | FAB with actions | Expandable action menu |
| Toast | Toast notification | Context-based provider |
| KeyboardAvoidingAnimatedView | Keyboard-aware layout | Reanimated transitions |

## Card Components

**Directory:** `components/cards/`

| Component | Purpose |
|-----------|---------|
| StatCard | Statistics display (points, earnings) |
| SurveyCard | Survey preview in feed |
| QuestionCard | Question preview in feed |
| VideoCard | Video preview thumbnail |
| DailyRewardCard | Daily reward opportunity |
| ProgressCard | Progress tracking visualization |
| RecentQuestionCard | Recent question snippet |
| ExploreCard | Content discovery card |
| LeaderboardCard | Leaderboard entry row |
| ProfileSupportCard | Support info in profile |
| ProfileNotificationCard | Notification preferences |

**Shared:** SearchBar, SearchOverlay, Section, SectionHeader

## Feed Components

**Directory:** `components/feed/`

| Component | Purpose | Notes |
|-----------|---------|-------|
| QuestionFeedItem | Single question in feed | Memoized, with voting UI |
| FeedTabs | Tab navigation | For You, Trending, Recent |
| CreateQuestionWizard | Question creation wizard | Multi-step form |
| CTACards | Call-to-action cards | AnswerEarnCTA, InstantRewardCTA, AskCommunityCTA |
| GamificationComponents | Streak, points, badges | StreakCounter, DailyProgress, LeaderboardSnippet |
| SkeletonLoaders | Loading placeholders | Feed, tabs, stats, sections |

## Home Screen Components

**Directory:** `components/home/`

| Component | Purpose |
|-----------|---------|
| PersonalizedHeader | Hero greeting with name, streak ring, last earned |
| HeroRewardCard | Large daily reward opportunity with confetti |
| QuickActions | Quick action buttons row (Videos, Questions, Surveys, Instant) |
| EarningOpportunityCard | Single earning opportunity |
| EarningOpportunitiesList | Vertical list of opportunities |
| SkeletonLoader | Home-specific skeleton variants |

## Video Components

**Directory:** `components/video/`

| Component | Purpose | Notes |
|-----------|---------|-------|
| VerticalVideoFeed | Vertical feed container | FlatList with viewability tracking |
| VideoFeedItem | Single video in feed | Memoized, handles ads/sponsored |
| VideoPlayer | Core video player | expo-video based |
| VideoPlayerOverlay | Player controls | Play, progress, volume, quality |
| EnhancedMiniPlayer | PiP mini player | Draggable, Reanimated |
| MiniPlayer | Basic mini player | |
| VideoActions | Engagement buttons | Like, bookmark, share, comment |
| VideoComments | Comments list | |
| VideoCommentsSheet | Bottom sheet comments | @gorhom/bottom-sheet |
| UploadModal | Video upload dialog | |
| SearchResults | Video search results | |
| TrendingVideoSlider | Horizontal trending carousel | |
| InlineVideoPlayer | Inline player for feeds | |
| VideoFeedSkeleton | Loading skeleton | |
| VideoErrorBoundary | Error boundary | Crash-safe video rendering |

## Livestream Components

**Directory:** `components/livestream/`

| Component | Purpose |
|-----------|---------|
| LiveStreamScreen | Main recording interface |
| CameraControls | Camera control toolbar |
| CameraControlButton | Single camera control |
| BottomControls | Bottom action bar (record, end, zoom) |
| RecordButton | Record/stop with pulsing animation |
| RecordingTimer | Elapsed recording time |
| RecordingProgressBar | Duration progress indicator |
| PermissionPrompt | Camera/mic permission request |
| GradientOverlay | Decorative gradient |

## Quiz Components

**Directory:** `components/quiz/`

| Component | Purpose | Notes |
|-----------|---------|-------|
| QuizProgressBar | Question progress | |
| CircularTimer | Circular countdown | SVG-based |
| ScoreBadge | Score/points display | |
| OptionButton | Multiple choice answer | Animated selection |
| TextInputAnswer | Text answer input | |
| AnswerFeedback | Correct/incorrect display | |
| SessionSummaryCard | Quiz results card | |
| AnswerResultOverlay | Post-answer animation | Reanimated, confetti |
| RewardSessionSummary | Session summary modal | Accuracy ring, earnings, redemption |
| RedemptionModal | Multi-step redemption wizard | 7 steps: type → amount → details → confirm → processing → success → error |
| QuestionTimer | SVG circular countdown | Color phases: normal → warning → critical |
| CompactQuestionTimer | Compact timer variant | |
| SessionClosedModal | Session ended overlay | EXPIRED / SLOTS_FULL / COMPLETED reasons |
| RedemptionOptions | Redemption type selection | Cash or Airtime |
| SpotsStatus | Spots remaining display | Progress bar + urgency badges |
| SpotsInlineBadge | Inline spots badge | "Last spot!", "Sold out" |

## Ad Components

**Directory:** `components/ads/`

| Component | Purpose | Notes |
|-----------|---------|-------|
| AdPlacementWrapper | Smart ad placement container | IAB viewability tracking |
| InterstitialAd | Full-screen ad | 5s skip countdown |
| StickyBanner | Fixed position banner | Auto-hide, spring animation |
| InFeedAd | In-feed ad unit | Stagger animation, impression tracking |
| BetweenContentAd | Between-content ad | |
| AdCarousel | Horizontal ad carousel | |
| StandardAd | Horizontal layout ad | 120px image + text |
| FeaturedAd | Large featured ad | Full-width image/video |
| BannerAd | Strip banner | 80px height |
| CompactAd | Minimal footprint | 56px height |
| NativeAd | Facebook/Instagram style | Avatar, content, CTA |
| CardAd | Card-based for carousels | 70% screen width |
| SmartAd | Auto-selects best variant | Based on ad.type |
| VideoAdComponent | Video ad player | Auto-play, skip button |
| AdFeedbackModal | "Why this ad?" modal | GDPR transparency |
| NativeQuestionAd | Ad styled as question | |
| SkippableVideoAd | Video with skip | |
| AdPreviewCard | Ad preview for testing | |

## Profile Components

**Directory:** `components/profile/`

| Component | Purpose |
|-----------|---------|
| ProfileUserCard | User header (avatar, name, stats) |
| QuickActionsGrid | Quick action buttons grid |
| SettingsSection | Collapsible settings |
| OTPVerificationModal | OTP input and verification |
| EditProfileModal | Edit profile information |
| TransactionsCard | Recent transactions |
| ProfileSkeleton | Loading skeleton |
| AnimatedCard | Card with entrance animation |

## Survey Components

**Directory:** `components/survey/`

| Component | Purpose | Notes |
|-----------|---------|-------|
| SurveyForm | Dynamic form generator with undo/redo | 11 question types, uses SurveyBuilderStore |
| SurveyCreationFAB | Floating action button for creation modes | Backdrop dim on expand |
| SurveyShareModal | Share survey link modal | Swipe-to-dismiss, copy with announceForAccessibility |
| SurveyTemplatesGallery | Template browser (built-in + custom) | My Templates tab |
| ImportWizard | CSV/JSON import with auto-mapping | Column confidence scoring, partial imports |
| ConversationalBuilder | AI-assisted question builder | Tone/length sliders |
| ConditionalLogicEditor | Per-question branching rules | Operators: equals, contains, greater_than, etc. |
| FileUploadQuestion | File upload question (respondent) | expo-document-picker, progress bar, retry |
| DraggableQuestionList | Drag-reorder with Reanimated 2 | Spring animations, 1-indexed a11y announcements |
| UndoRedoToolbar | Undo/Redo button bar | Haptic feedback, reads SurveyBuilderStore |
| WebhookSetupModal | Webhook configuration UI | URL validation, event checkboxes, test delivery |
| DevicePreviewFrame | Device frame mockup for previews | iPhone/iPad/Android toggle |
| CollaboratorAvatars | Real-time presence indicators | Avatar bubbles, "User X editing Q3" |
| CreationProgressBadges | Builder milestone badges | "First Question", "Logic Master", etc. |
| SessionClosedModal | Session ended modal | Reasons: EXPIRED, SLOTS_FULL, COMPLETED |

**Question Types:** text, radio, checkbox, rating, matrix, ranking, select, date/time, range, slider, file_upload

## Notification Components

Multiple notification display and preference components.

## Payment Components

**Directory:** `components/payment/`

| Component | Purpose |
|-----------|---------|
| PaymentProviderCard | Payment method selection (MTN/Airtel) |
| SubscriptionPlanCard | Subscription tier display |

## Shared Patterns

### Memoization

All list items use `React.memo` with custom comparison:

```typescript
const VideoFeedItem = React.memo(function VideoFeedItem(props) {
  // ...
}, arePropsEqual);
```

### Skeleton Loaders

Every major section has a skeleton loader:

- `FeedSkeleton`, `GamificationSkeleton`, `TabsSkeleton`
- `HeroCardSkeleton`, `QuickActionsRowSkeleton`
- `VideoFeedSkeleton`, `ProfileSkeleton`

### Error Boundaries

`VideoErrorBoundary` wraps video components to prevent crashes from player errors.

### Accessibility

- All interactive elements have `accessibilityRole` and `accessibilityLabel`
- Touch targets are minimum 44x44dp
- Reduced motion support via `AccessibilityInfo.isReduceMotionEnabled()`
- Screen reader announcements for important state changes
