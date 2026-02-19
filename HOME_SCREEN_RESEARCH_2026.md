# Home Screen / Dashboard Research Report — 2026 Industry Standards

> Compiled February 2026. Actionable recommendations for a rewards/fintech mobile app (React Native + Expo).

---

## Table of Contents

1. [Lessons from Top Apps](#1-lessons-from-top-apps)
2. [UX Best Practices for Dashboards](#2-ux-best-practices-for-dashboards)
3. [Navigation Patterns from Home](#3-navigation-patterns-from-home)
4. [Visual Design Trends 2026](#4-visual-design-trends-2026)
5. [Performance Patterns](#5-performance-patterns)
6. [Accessibility for Dashboards](#6-accessibility-for-dashboards)
7. [State Management Patterns](#7-state-management-patterns)
8. [Actionable Implementation Plan for DelipuCash](#8-actionable-implementation-plan-for-delipucash)

---

## 1. Lessons from Top Apps

### Cash App — Radical Simplicity
- **Home screen** centers on a single, massive balance number with a prominent "Pay" CTA above the fold.
- **Single-question onboarding** keeps momentum high and reduces drop-offs — each screen asks one thing.
- **Quick actions row** (Pay, Request, Cash Card) sits directly below the balance. No more than 4 items.
- **Takeaway for DelipuCash**: Put the user's reward balance front and center. One dominant CTA ("Earn Now" or "Redeem") directly below.

### Revolut / Wise — Financial Super App Dashboards
- **Revolut** highlights real-time balances, budget insights, and recent transactions, all personalized based on user behavior. Behavioral insights drive personalized notifications, card controls, and budgeting tips.
- **Wise** excels at fee breakdown clarity, visually explaining exchange rates and charges upfront with plain-language microcopy.
- **Real-time animations** and instant toast notifications confirm every step of a transaction, building trust.
- **Takeaway for DelipuCash**: Show last activity and personalized earning recommendations. Use toast confirmations for reward claims. Display reward-to-cash conversion rates transparently.

### Duolingo — Gamification Dashboard
- Streaks increase commitment by 60%, XP leaderboards drive 40% more engagement, badges boost completion rates by 30%.
- Users who maintain a 7-day streak are 3.6x more likely to stay engaged long-term.
- The "Streak Freeze" feature reduced churn by 21% for at-risk users.
- Core loop: Cue (reminder/prompt) -> Action (short lesson) -> Reward (XP, streak count, league position, visual feedback).
- AI-driven dynamic difficulty: 28% longer session length vs. static paths.
- **Takeaway for DelipuCash**: Implement a daily earning streak with visual tracker on home screen. Add streak freeze as a purchasable item. Show XP/points with animated progress bar. Create weekly leaderboards for top earners.

### Swagbucks / InboxDollars — Rewards App Home Screens
- **InboxDollars** displays earnings in actual dollars (not points), which is a psychological benefit — users don't perform mental math.
- **Swagbucks** lets users stack multiple earning methods simultaneously: surveys, shopping cashback, watching videos, playing games.
- Clean, list-based interfaces with clear earnings-per-task shown upfront.
- **Takeaway for DelipuCash**: Show earnings in real currency alongside points. List available earning activities with estimated reward values. Enable multi-path earning from the home screen.

### TikTok / Instagram — Content Discovery Feeds
- Algorithm-driven "For You" feed as default home view.
- Story/highlights row at top for ephemeral content.
- Pull-to-refresh with haptic feedback.
- Infinite scroll with varying content types (video, image, text).
- **Takeaway for DelipuCash**: Use a personalized content feed for questions/videos below the hero section. Implement a horizontal scrollable row for featured/trending items.

### Grab / Gojek — Super App Multi-Service Dashboards
- Even with dozens of services, the UI never feels overwhelming. WeChat supports 1M+ mini programs but tucks services into tabs.
- **Grab** personalizes home screens in real-time to highlight services users actually use.
- Consistent navigation, unified wallets, and single sign-on across services.
- Grid of service icons (2x4 or 3x3) with most-used services auto-promoted to top positions.
- **Takeaway for DelipuCash**: Use a service grid (Questions, Videos, Surveys, Rewards, Instant Rewards) with adaptive ordering based on usage. Keep grid to 6-8 items maximum.

### Robinhood — Portfolio Dashboard
- First screen after login: large line chart showing portfolio performance.
- Modular card layout — all data organized into purposeful, interactive blocks.
- Cards display each holding; tapping expands charting, news, and buy opportunities.
- Bottom tab bar: portfolio, watchlist, history, account.
- **Takeaway for DelipuCash**: Consider a mini chart/graph showing earnings over time at the top. Use expandable cards for each earning category.

---

## 2. UX Best Practices for Dashboards

### 2.1 Information Hierarchy — What Goes Above the Fold

The most critical insights must appear at the top or in the most prominent area. Users scan in F-pattern or Z-pattern layouts.

**Recommended above-the-fold stack (top to bottom):**

| Priority | Element | Purpose |
|----------|---------|---------|
| 1 | Greeting + streak indicator | Personalization + retention hook |
| 2 | Balance / earnings card | Primary value proposition |
| 3 | Quick actions row (3-4 items) | Immediate task access |
| 4 | Active promotion / daily challenge | Engagement driver |

Everything below the fold: activity feed, content sections, secondary features.

### 2.2 Personalization Patterns

- **Greeting**: "Good morning, [Name]" with time-of-day awareness.
- **Last activity**: "You earned 50 points yesterday from surveys."
- **Recommendations**: AI-driven card reordering based on user behavior. A finance app might push a spending summary on Friday evening because that's when users review budgets.
- **Context-aware triggers**: Time of day, location, and usage patterns predict intent and surface relevant actions.

### 2.3 Quick Actions Pattern

- Limit to 3-5 circular or rounded-rectangle icons with labels.
- Most-used actions should auto-promote to first position.
- Use consistent iconography and short (1-2 word) labels.
- Examples: "Answer", "Watch", "Redeem", "Invite".

### 2.4 Widget / Card-Based Layouts

Cards are the dominant pattern across all top apps in 2026:
- Each card is a self-contained, tappable unit with a clear purpose.
- Cards support progressive disclosure — show summary, tap for details.
- Netflix-style personalization: adjust card appearance based on user preferences.
- From UberEats' utility-driven approach to Headspace's emotional design, cards work across industries.

**Card anatomy:**
```
+-------------------------------+
| Icon/Image    Title      Badge|
| Subtitle / description        |
| Progress bar or metric        |
| CTA button (optional)         |
+-------------------------------+
```

### 2.5 Pull-to-Refresh Behavior

- Use native pull-to-refresh gesture with haptic feedback.
- Show a custom branded animation during refresh (Lottie animation).
- Refresh should feel instant — use stale-while-revalidate so content is already cached.
- Avoid full-screen loading states during refresh; update individual sections.

### 2.6 Skeleton Loading Patterns

Skeleton screens improve perceived performance by 20-30% compared to spinners.

**Best practices:**
- Skeleton layout must exactly match final loaded layout (prevents layout shift).
- Use shimmer/wave animation (left-to-right gradient sweep).
- Duration: display for minimum 200ms (avoid flash), maximum 3-5 seconds before showing error state.
- Apply to container elements: cards, lists, grids. NOT to buttons, inputs, or small UI elements.
- Use distinguishable colors for both light and dark themes.
- Progressive loading: replace individual skeletons as data arrives, not all at once.

### 2.7 Empty State Design

Three types of empty states:
1. **First use**: Welcome illustration + clear CTA to start earning. "Complete your first survey to earn 100 points!"
2. **User cleared**: Celebratory state. "All caught up! Check back later for new opportunities."
3. **No results**: Helpful guidance. "No matching results. Try adjusting your filters."

Each empty state should include:
- An illustration or icon (not just text).
- A clear explanation of WHY it's empty.
- A CTA to resolve the emptiness.

### 2.8 Error State Design

- Use inline error states, not full-page errors.
- Provide a retry action on every error card.
- Use empathetic microcopy: "Something went wrong. Tap to try again." (not "Error 500").
- For network errors specifically: "You're offline. Your balance was last updated 5 min ago."
- Always show cached/stale data when available alongside the error indicator.

### 2.9 Progressive Disclosure

- Show summary on the dashboard; details on drill-down screens.
- Use "See all" links to transition from dashboard previews to full lists.
- Expandable cards for inline detail viewing without navigation.
- Limit dashboard to 5-7 distinct sections to prevent overwhelm.

### 2.10 Content Density Balance

- Generous white space to reduce visual stress.
- Limit color usage — color should guide decisions, not decorate.
- One primary CTA per viewport. Secondary actions should be visually subdued.
- Use soft gradients, bold typography, neutral palettes, minimal borders, and smooth shadows.

---

## 3. Navigation Patterns from Home

### 3.1 Tab Bar Design

Bottom tab navigation is the gold standard for mobile apps in 2026.

**Best practices:**
- 3-5 tabs maximum. Studies show odd numbers (3 or 5) create better visual rhythm.
- Active state: filled icon + label + brand color. Inactive: outlined icon + muted label.
- Labels are mandatory (icon-only tabs fail accessibility and discoverability).
- Minimum touch target: 48x48dp (WCAG 2.2 minimum for Level AA).
- Respect platform conventions: iOS tab bar + safe area insets; Android bottom navigation.

**Recommended tab structure for DelipuCash:**
```
[ Home ]  [ Earn ]  [ + ]  [ Rewards ]  [ Profile ]
```

### 3.2 Deep Navigation from Dashboard Cards

- Every card on the dashboard should be tappable with clear navigation destination.
- Use shared element transitions (react-native-reanimated) for visual continuity.
- Breadcrumb-less navigation: rely on back gestures and tab bar for orientation.
- Cards that navigate should have a subtle chevron or "See all >" affordance.

### 3.3 Notification Badge Patterns

- Red dot (no count) for general attention (e.g., new features).
- Red badge with count for actionable items (e.g., "3 new rewards available").
- Maximum displayed count: "9+" to prevent badge from becoming too wide.
- Micro-animation on badge appearance (scale-in with spring physics).
- Place on tab bar icons AND on relevant dashboard cards.
- Clear badge state immediately when user enters that section.

### 3.4 FAB (Floating Action Button) Patterns

- Use only ONE FAB per screen for the single most important positive action.
- Position: bottom-right, 16dp from edges.
- FAB should represent positive/creative actions only (create, earn, share) — never destructive actions.
- Consider an expanding FAB that reveals 2-3 sub-actions on tap.
- For DelipuCash: A "+" FAB that expands to "Ask Question", "Watch Video", "Take Survey".

### 3.5 Search Integration

- Search icon in the header or a collapsible search bar.
- Recent searches and trending/popular items displayed on focus.
- Search should cover all content types: questions, videos, surveys, rewards.
- Predictive/autocomplete suggestions.

### 3.6 Story / Highlights Row Pattern

- Horizontal scrollable row of circular avatars/thumbnails at the top of the feed.
- Use for: featured challenges, trending topics, daily picks, or user spotlights.
- Unviewed items have a colored ring border; viewed items have a gray/no ring.
- Auto-advances when tapped (full-screen overlay with progress bar).
- **For DelipuCash**: Featured daily challenges, trending questions, or reward spotlights.

---

## 4. Visual Design Trends 2026

### 4.1 Card Elevation and Shadows

- Soft, smooth shadows are in. Hard drop shadows are out.
- Shadow values: `shadowOffset: {width: 0, height: 2}, shadowRadius: 8, shadowOpacity: 0.08`.
- Cards float 2-4dp above background. No more than 2 elevation levels on a single screen.
- Border-radius: 12-16px is the current standard. Sharp corners are rare.

### 4.2 Glassmorphism Status — Matured and Selective

Apple's "Liquid Glass" across macOS and iOS made glassmorphism mainstream in 2025. In 2026 it has matured:
- Use sparingly for hero cards or overlay elements (not every card).
- Frosted glass effect: `background: rgba(255,255,255,0.15)` + `backdrop-filter: blur(20px)`.
- Works best on top of gradient or image backgrounds.
- In React Native: use `@react-native-community/blur` or `expo-blur` for BlurView.
- **Recommendation**: Use for the main balance card only, over a gradient hero background.

### 4.3 Color Systems and Gradients

- Soft, multi-color gradients add richness without overwhelming users.
- Modern gradients are subtle, sophisticated, and purposeful — adding depth, not decoration.
- Neutral palettes with one bold accent color for CTAs.
- Recommended palette structure:
  - Primary: 1 brand color (for CTAs, active states).
  - Secondary: 1 complementary color (for accents, badges).
  - Neutrals: 5-7 shades of gray (backgrounds, text, dividers).
  - Semantic: green (success/earnings), red (error/loss), amber (warning/pending).

### 4.4 Typography Hierarchy

Bold, expressive typography is a defining trend of 2026:

| Level | Usage | Size | Weight |
|-------|-------|------|--------|
| Display | Balance amount | 32-40px | Bold/Black |
| H1 | Section headers | 24-28px | Bold |
| H2 | Card titles | 18-20px | SemiBold |
| Body | Descriptions | 14-16px | Regular |
| Caption | Metadata, timestamps | 12px | Regular |
| Overline | Labels, categories | 10-11px | Medium, uppercase |

- Use a single font family (e.g., Inter, SF Pro, or a custom brand font).
- Line height: 1.4-1.6x font size for readability.
- Maximum 3 font weights per screen to maintain clarity.

### 4.5 Iconography

- Consistent icon set: choose one and stick with it (SF Symbols for iOS feel, Material Symbols for cross-platform, or custom Phosphor/Lucide icons).
- Outlined icons for inactive states, filled for active states.
- Icon size: 24px standard, 20px compact, 28-32px for primary actions.
- Avoid mixing icon libraries — creates visual inconsistency.

### 4.6 Micro-interactions and Motion Design

In 2026, motion is shifting toward "whisper feedback" — subtle cues that save battery and maintain focus:

- **Duration**: 200-500ms is ideal. Long enough to notice, short enough to not block.
- **Spring physics**: `Animated.spring()` with `damping: 15, stiffness: 150` for natural-feeling bounces.
- **Context-aware animations**: Adapt to device battery level and network conditions.
- **Lottie animations**: Lightweight, vector-based. Use for celebratory moments (reward claimed, streak achieved).
- **Haptic feedback**: Light impact on button press, medium on success, warning on error.
- **Reduced motion**: Always respect `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled()`.

### 4.7 Dark Mode Best Practices

Dark mode is no longer optional — it's expected:

- **Background**: Use dark gray (#121212 or #1C1C1C), NOT pure black (#000000).
- **Text**: Soft white (#E0E0E0 to #F5F5F5), NOT pure white (#FFFFFF).
- **Contrast ratio**: Minimum 4.5:1 for normal text, 3:1 for large text.
- **Desaturated colors**: Reduce saturation of brand colors by 10-20% in dark mode to prevent vibrating.
- **Elevation = lighter**: In dark mode, higher elevation surfaces should be slightly lighter (not shadowed).
- **Do NOT auto-invert**: Design dark surfaces intentionally — flipped colors cause discomfort and eye fatigue.
- **Images**: Add a subtle dark overlay or use dark-mode-specific image assets.

---

## 5. Performance Patterns

### 5.1 Above-the-Fold Optimization

- Render a trimmed, above-the-fold UI immediately; defer heavy widgets below.
- Target: first meaningful paint within 1-2 seconds.
- Inline critical data (balance, greeting) in initial server response or cache.
- Use `initialNumToRender` on FlatList to render only visible items.

### 5.2 Lazy Loading Below-Fold Sections

- Use React Navigation's built-in lazy-loading for tab screens.
- Dynamic `import()` for below-fold dashboard sections.
- Intersection Observer pattern: load sections as they scroll into viewport.
- Defer ad loading until feed content has rendered (`enabled: !isFeedLoading`).

### 5.3 Image Optimization

- Use WebP format (25-35% smaller than PNG/JPEG).
- Resize images to exact display dimensions with @2x/@3x variants.
- Use `expo-image` or `react-native-fast-image` with disk caching.
- Blur hash or thumbnail placeholder during image load.
- Avatar images: serve as 64x64px thumbnails, not full-resolution.

### 5.4 Skeleton Screen Timing

| Duration | Action |
|----------|--------|
| 0-200ms | Show nothing (prevents flash for fast loads) |
| 200ms-3s | Show skeleton screen with shimmer |
| 3-5s | Add "Taking longer than usual..." text |
| 5s+ | Show error/retry state |

### 5.5 Perceived Performance Tricks

- **Stale-while-revalidate**: Show cached data instantly, refresh in background.
- **Optimistic updates**: Reflect actions immediately, roll back on failure.
- **Progressive loading**: Replace individual skeletons as each data source resolves.
- **Prefetching**: When user hovers over or approaches a card, prefetch destination data.
- **Animation during load**: Meaningful loading animations make waits feel 20-30% shorter.

### 5.6 React Native Specific Optimizations

- Enable New Architecture (Fabric + TurboModules) for up to 40% less bridge overhead.
- FlatList tuning: `windowSize: 10-15`, `initialNumToRender: 10-20`, `maxToRenderPerBatch: 5-10`.
- Use `getItemLayout` for consistent item heights to skip measurement.
- Wrap expensive components in `React.memo()` with proper dependency comparison.
- Extract `renderItem` functions outside component body to prevent re-creation.
- Cap entrance animations: `MAX_ANIMATED_INDEX = 8` (already implemented in your codebase).

---

## 6. Accessibility for Dashboards

### 6.1 Screen Reader Navigation Order

React Native renders native UI components interpreted by the OS accessibility tree.

- Set logical tab order matching visual layout (top-to-bottom, left-to-right).
- Group related elements: use `accessible={true}` on container to combine child elements into single announcements.
- Balance card should be one focusable unit: "Your balance: 5,230 points, equivalent to $52.30."
- Quick action buttons: each individually focusable with clear labels.

### 6.2 Heading Hierarchy

- Use `accessibilityRole="header"` on section titles.
- Maintain logical heading levels (H1 for screen title, H2 for section headers).
- Screen reader users can navigate by jumping between headings — make them meaningful.
- Example heading order: "Home" (H1) -> "Your Balance" (H2) -> "Quick Actions" (H2) -> "Today's Challenges" (H2) -> "Recent Activity" (H2).

### 6.3 Live Regions for Dynamic Content

- **Android**: `accessibilityLiveRegion="polite"` for non-urgent updates (balance refresh, new content loaded).
- **Android**: `accessibilityLiveRegion="assertive"` for urgent updates (reward claimed, error).
- **iOS**: `AccessibilityInfo.announceForAccessibility("Balance updated to 5,230 points")`.
- Rule: "Move focus for navigation changes. Announce for feedback updates."

### 6.4 Touch Target Sizes (WCAG 2.2)

- **Minimum**: 24x24 CSS pixels (WCAG 2.2 Level AA - Target Size Minimum).
- **Recommended**: 44x44pt (Apple HIG) / 48x48dp (Material Design).
- Applies to all interactive elements: buttons, cards, tab bar items, icons.
- Spacing between targets: minimum 8dp gap to prevent accidental activation.
- Bottom navigation items benefit from larger targets for users with limited mobility.

### 6.5 High Contrast Mode

- Test all color combinations at 4.5:1 minimum contrast ratio.
- Support system-level high contrast settings.
- Avoid conveying information through color alone — use icons, patterns, or text labels.
- In dark mode, ensure desaturated colors still meet contrast minimums.

### 6.6 Reduced Motion

- Check `AccessibilityInfo.isReduceMotionEnabled()` on mount.
- Replace spring/fade animations with instant layout changes.
- Disable auto-playing animations (Lottie celebrations, shimmer effects).
- Skeleton screens should use static placeholder (no shimmer) in reduced motion mode.
- Streak counters and progress bars should jump to final state.

### 6.7 Focus Management After Navigation

- Use `AccessibilityInfo.setAccessibilityFocus(ref)` when UI significantly changes.
- After modal open: focus on modal title.
- After inline error: focus on error message.
- After pull-to-refresh: announce "Content updated" without moving focus.
- Test with real VoiceOver (iOS) and TalkBack (Android) on devices — emulators miss focus issues.

---

## 7. State Management Patterns

### 7.1 Optimistic UI for Balance Updates

```
Pattern:
1. Store previous state before update
2. Apply update immediately (user sees instant feedback)
3. Send request to server
4. On success: confirm (maybe with subtle animation)
5. On failure: revert to stored state + show non-intrusive error toast
```

- Keep API calls idempotent — multiple identical requests should have same effect.
- Use TanStack Query's `onMutate` / `onError` / `onSettled` for clean optimistic update lifecycle.
- Already implemented in your codebase for video likes/bookmarks and question responses.

### 7.2 Stale-While-Revalidate for Dashboard Data

- Show cached data instantly (stale), fetch fresh data in background (revalidate).
- Data less than 5 minutes old is considered "fresh" — no background refresh needed.
- Configure per-section staleness:

| Section | staleTime | gcTime |
|---------|-----------|--------|
| Balance | 30 seconds | 5 minutes |
| Feed items | 2 minutes | 10 minutes |
| User profile | 5 minutes | 30 minutes |
| Leaderboard | 5 minutes | 15 minutes |
| Ads | 10 minutes | 30 minutes |

### 7.3 Background Refresh Intervals

- Balance: `refetchInterval: 30_000` (30 seconds when app is active).
- Feed: `refetchInterval: 120_000` (2 minutes).
- All intervals: `refetchIntervalInBackground: false` (already implemented).
- Use `AppState` listener to trigger refresh on app foreground.

### 7.4 Offline-First Dashboard Design

The local device is the primary source of truth; the network is a background optimization.

- Cache last-known dashboard state in AsyncStorage (via Zustand persistence).
- On app open: immediately render cached state, then fetch fresh data.
- Show staleness indicator: "Last updated 5 minutes ago" in subtle text.
- Queue actions (reward claims, question answers) when offline; flush on reconnect.
- Already implemented: `addPendingSubmission` in store, flushed when `isOnline` changes.

### 7.5 Cross-Tab State Synchronization

- Balance updates from any screen should reflect immediately on home dashboard.
- Use TanStack Query's cache invalidation: when a reward is claimed on the Rewards tab, invalidate the balance query so Home tab shows updated balance.
- Zustand selectors (`selectCanRedeem`) provide reactive state across screens.
- Avoid manual state passing between tabs — let the query cache be the single source of truth.

---

## 8. Actionable Implementation Plan for DelipuCash

### 8.1 Recommended Home Screen Layout (Top to Bottom)

```
┌─────────────────────────────────┐
│  Status Bar                     │
├─────────────────────────────────┤
│  Header: Avatar + "Hi, Name"   │
│         🔔 Bell icon (badge)   │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │  <- Glassmorphism card
│  │  BALANCE HERO CARD      │   │     over gradient BG
│  │  ★ 5,230 pts ($52.30)  │   │
│  │  ↑ +320 this week       │   │
│  │  🔥 7-day streak        │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  Quick Actions Row              │
│  [Answer] [Watch] [Survey] [+] │
├─────────────────────────────────┤
│  ═══ ABOVE THE FOLD ═══════════│
├─────────────────────────────────┤
│  Daily Challenge Card           │
│  "Answer 3 questions today"     │
│  ████████░░ 2/3 complete        │
├─────────────────────────────────┤
│  Featured Rewards (horiz scroll)│
│  [Card] [Card] [Card] →        │
├─────────────────────────────────┤
│  Trending Questions Section     │
│  "See all >"                    │
│  [Question Card]                │
│  [Question Card]                │
├─────────────────────────────────┤
│  Recent Activity                │
│  • Earned 50 pts - Survey       │
│  • Earned 100 pts - Question    │
├─────────────────────────────────┤
│  Leaderboard Preview            │
│  "You're #42 this week"         │
├─────────────────────────────────┤
│                                 │
│  ══ Tab Bar ═══════════════════ │
│  [Home] [Earn] [+] [Rewards]   │
│  [Profile]                      │
└─────────────────────────────────┘
```

### 8.2 Component Architecture

```
HomeScreen
├── HomeHeader (React.memo)
│   ├── UserAvatar
│   ├── GreetingText (time-aware)
│   └── NotificationBell (badge count)
├── BalanceHeroCard (glassmorphism)
│   ├── PointsDisplay (large, bold)
│   ├── CashEquivalent (secondary text)
│   ├── WeeklyChange (green/red indicator)
│   └── StreakBadge (flame icon + count)
├── QuickActionsRow (React.memo)
│   ├── ActionButton x 4
│   └── (adaptive ordering based on usage)
├── DailyChallengeCard
│   ├── ChallengeDescription
│   └── ProgressBar (animated)
├── FeaturedRewardsCarousel
│   └── RewardCard x N (horizontal FlatList)
├── TrendingQuestionsSection
│   ├── SectionHeader ("See all >")
│   └── QuestionCard x 3
├── RecentActivitySection
│   └── ActivityItem x 5
└── LeaderboardPreview
    ├── UserRank
    └── TopThreeAvatars
```

### 8.3 Data Fetching Strategy

```typescript
// Single dashboard query that returns all above-the-fold data
const useDashboard = () => useQuery({
  queryKey: ['dashboard'],
  queryFn: fetchDashboard,
  staleTime: 30_000,
  gcTime: 5 * 60_000,
});

// Below-fold sections loaded lazily
const useTrendingQuestions = () => useQuery({
  queryKey: ['questions', 'trending'],
  queryFn: fetchTrending,
  staleTime: 2 * 60_000,
  enabled: isAboveFoldRendered,  // defer until hero is visible
});

const useRecentActivity = () => useQuery({
  queryKey: ['activity', 'recent'],
  queryFn: fetchRecentActivity,
  staleTime: 60_000,
  enabled: isAboveFoldRendered,
});
```

### 8.4 Skeleton Loading Structure

```
┌─────────────────────────────────┐
│  [█] ████████         [█]      │  <- Header skeleton
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │  ████████████           │   │  <- Balance skeleton
│  │  ██████                 │   │
│  │  █████████              │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  [██] [██] [██] [██]          │  <- Quick actions skeleton
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │  ████████████████       │   │  <- Challenge skeleton
│  │  ████████░░░░░░░░       │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

- Match skeleton shapes exactly to final content layout.
- Shimmer animation: left-to-right gradient sweep, 1.5s duration.
- Show skeleton for 200ms minimum (no flash), transition to error after 5s.

### 8.5 Gamification Elements to Implement

| Element | Location | Impact |
|---------|----------|--------|
| Daily streak | Hero card | +60% daily return rate |
| Streak freeze | Store/purchasable | -21% churn for at-risk users |
| Weekly leaderboard | Bottom of home | +40% engagement |
| Progress badges | Profile + home card | +30% task completion |
| Daily challenge | Below quick actions | Drives specific behaviors |
| Earning milestones | Toast notifications | Celebratory reinforcement |

### 8.6 Priority Implementation Order

1. **Balance Hero Card** with glassmorphism, streak indicator, and weekly change.
2. **Quick Actions Row** with 4 adaptive shortcuts.
3. **Skeleton Loading** for the entire home screen.
4. **Daily Challenge Card** with progress bar.
5. **Featured Rewards Carousel** (horizontal scroll).
6. **Trending Content Section** with lazy loading.
7. **Notification Badge System** on tab bar + bell icon.
8. **Leaderboard Preview** widget.
9. **Dark Mode** full support.
10. **Accessibility Pass** (screen reader, reduced motion, touch targets).

---

## Sources

### Fintech UX & Dashboard Design
- [10 Best Fintech UX Practices for Mobile Apps in 2025](https://procreator.design/blog/best-fintech-ux-practices-for-mobile-apps/)
- [Fintech UX Best Practices 2026: Build Trust & Simplicity](https://www.eleken.co/blog-posts/fintech-ux-best-practices)
- [Top 10 Fintech UX Design Practices Every Team Needs in 2026](https://www.onething.design/post/top-10-fintech-ux-design-practices-2026)
- [Mobile Banking App Design: UX & UI Best Practices for 2026](https://www.purrweb.com/blog/banking-app-design/)
- [Fintech UX Design Best Practices for 2026](https://codetheorem.co/blogs/fintech-ux-design/)
- [Top 15 Banking Apps with Exceptional UX Design (2026)](https://www.wavespace.agency/blog/banking-app-ux)

### Dashboard Design Principles
- [Intuitive Mobile Dashboard UI: 4 Best Practices](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [9 Dashboard Design Principles (2026)](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Effective Dashboard Design Principles for 2025](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [20 Best Dashboard UI/UX Design Principles You Need in 2025](https://medium.com/@allclonescript/20-best-dashboard-ui-ux-design-principles-you-need-in-2025-30b661f2f795)

### Navigation Patterns
- [Mobile Navigation UX Best Practices, Patterns & Examples (2026)](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)
- [Mobile Navigation Patterns and Best Practices](https://www.storyly.io/post/basic-patterns-for-mobile-navigation-and-the-best-practices)
- [Bottom Navigation Bar: The Complete 2025 Guide](https://blog.appmysite.com/bottom-navigation-bar-in-mobile-apps-heres-all-you-need-to-know/)
- [Mobile Navigation Patterns: Pros and Cons](https://www.uxpin.com/studio/blog/mobile-navigation-patterns-pros-and-cons/)

### Visual Design & Trends
- [Best Mobile App UI/UX Design Trends for 2026](https://natively.dev/blog/best-mobile-app-design-trends-2026)
- [9 Mobile App Design Trends for 2026](https://uxpilot.ai/blogs/mobile-app-design-trends)
- [Top 10 Trends in UI/UX Mobile App Design for 2026](https://dev-story.com/blog/mobile-app-ui-ux-design-trends/)
- [12 UI/UX Design Trends That Will Dominate 2026](https://www.index.dev/blog/ui-ux-design-trends)

### Dark Mode
- [How to Design Dark Mode for Your Mobile App - A 2026 Guide](https://appinventiv.com/blog/guide-on-designing-dark-mode-for-mobile-app/)
- [Dark Mode Done Right: Best Practices for 2026](https://medium.com/@social_7132/dark-mode-done-right-best-practices-for-2026-c223a4b92417)
- [10 Dark Mode UI Best Practices & Principles for 2026](https://www.designstudiouiux.com/blog/dark-mode-ui-design-best-practices/)

### Motion & Micro-interactions
- [Motion Design & Micro-Interactions in 2026: UX Trends](https://www.techqware.com/blog/motion-design-micro-interactions-what-users-expect)
- [Motion UI Trends 2026: Interactive Design & Examples](https://lomatechnology.com/blog/motion-ui-trends-2026/2911)
- [Your 2026 Motion Strategy — LottieFiles](https://lottiefiles.com/motion-strategy)
- [UI/UX Evolution 2026: Micro-Interactions & Motion](https://primotech.com/ui-ux-evolution-2026-why-micro-interactions-and-motion-matter-more-than-ever/)

### Skeleton Screens & Performance
- [Skeleton Loading Screen Design — LogRocket](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/)
- [Skeleton Screens 101 — Nielsen Norman Group](https://www.nngroup.com/articles/skeleton-screens/)
- [Skeleton UI Design: Best Practices — Mobbin](https://mobbin.com/glossary/skeleton)
- [How to Boost React Native Performance: 2026 Developer Guide](https://www.mobileappdevelopmentcompany.us/blog/improve-performance-in-react-native-apps/)
- [React Native Performance Optimization in 2025](https://danielsarney.com/blog/react-native-performance-optimization-2025-making-mobile-apps-fast/)

### Gamification
- [Duolingo's Gamification Secrets: Streaks & XP Boost Engagement by 60%](https://www.orizon.co/blog/duolingos-gamification-secrets)
- [How to Design Like Duolingo: Gamification & Engagement](https://www.uinkits.com/blog-post/how-to-design-like-duolingo-gamification-engagement)
- [Mastering Gamification Design and Strategy in 2026](https://www.gamificationhub.org/gamification-design-and-strategy/)

### Super Apps
- [Top 5 UX Principles for Super App UI Design](https://procreator.design/blog/super-app-ui-principles-from-top-global-app/)
- [5 Super App Trends 2025](https://procreator.design/blog/super-app-trends-every-business-should-know/)
- [The Ultimate Guide to Launching a Super App in 2026](https://oyelabs.com/guide-to-launch-a-super-app/)

### Accessibility
- [Mobile App Accessibility: A Comprehensive Guide (2026)](https://www.accessibilitychecker.org/guides/mobile-apps-accessibility/)
- [React Native Accessibility Best Practices: 2025 Guide](https://www.accessibilitychecker.org/blog/react-native-accessibility/)
- [WCAG 2.2 Is Now an ISO Standard: What Changes for 2026](https://adaquickscan.com/blog/wcag-2-2-iso-standard-2025)
- [Guidance on Applying WCAG 2.2 to Mobile Applications](https://www.w3.org/TR/wcag2mobile-22/)

### State Management & Offline
- [Offline-First Frontend Apps in 2025 — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [React State Management in 2025](https://www.developerway.com/posts/react-state-management-2025)
- [Building Lightning-Fast UIs: Optimistic Updates with React Query and Zustand](https://medium.com/@anshulkahar2211/building-lightning-fast-uis-implementing-optimistic-updates-with-react-query-and-zustand-cfb7f9e7cd82)
- [Optimistic UI in Frontend Architecture](https://javascript.plainenglish.io/optimistic-ui-in-frontend-architecture-do-it-right-avoid-pitfalls-7507d713c19c)

### Rewards Apps
- [How to Build a Money Earning App like Swagbucks in 2025](https://devtechnosys.ae/blog/build-a-money-earning-app-like-swagbucks/)
- [Swagbucks vs InboxDollars Comparison](https://www.eneba.com/hub/play-to-earn/swagbucks-vs-inboxdollars/)

### Robinhood
- [How the Robinhood UI Balances Simplicity and Strategy](https://worldbusinessoutlook.com/how-the-robinhood-ui-balances-simplicity-and-strategy-on-mobile/)
- [Design Critique: Robinhood iOS App](https://ixd.prattsi.org/2025/02/design-critique-robinhood-ios-app/)

### Empty & Error States
- [Empty State UI Pattern: Best Practices — Mobbin](https://mobbin.com/glossary/empty-state)
- [Designing the Overlooked Empty States — UXPin](https://www.uxpin.com/studio/blog/ux-best-practices-designing-the-overlooked-empty-states/)
- [Loading, Empty and Error States Pattern](https://design-system.agriculture.gov.au/patterns/loading-error-empty-states)
