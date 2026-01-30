# Home Screen Redesign - 2025/2026 Modern Dashboard

## Overview

This document outlines the comprehensive redesign of the home/dashboard screen following industry-leading patterns from TikTok, Instagram, Cash App, Duolingo, and Swagbucks. The redesign focuses on:

1. **Addictive yet trustworthy UX** - Fast value recognition, clear next steps
2. **Modern visual design** - Material You + iOS Human Interface Guidelines
3. **Full accessibility** - WCAG 2.2 AA compliance
4. **High performance** - FlatList virtualization, lazy loading

---

## Architecture

### New Component Structure

```
components/home/
├── index.ts                    # Component exports
├── SkeletonLoader.tsx          # Shimmer loading states
├── PersonalizedHeader.tsx      # Greeting, streak ring, wallet preview
├── HeroRewardCard.tsx          # Large daily reward with confetti
├── QuickActions.tsx            # Quick action buttons row
└── EarningOpportunityCard.tsx  # Unified earning opportunity cards

utils/
└── accessibility.ts            # WCAG 2.2 AA utilities

app/(tabs)/
└── home-redesigned.tsx         # FlatList-based dashboard
```

### State Management

- **TanStack Query (React Query)** - Data fetching, caching, optimistic updates
- **Zustand** - UI state (modals, active sections)
- **React Native Reanimated** - Smooth animations with worklets

### Data Flow

```
User Data Hooks (TanStack Query)
        ↓
    sections[] array (memoized)
        ↓
    FlatList renderItem
        ↓
    Section Components
```

---

## Key Components

### 1. PersonalizedHeader

**Purpose:** Welcome users with personalized greeting, streak progress, and quick wallet access.

**Features:**
- Time-based greeting ("Good morning", "Good afternoon", etc.)
- Streak progress ring with SVG visualization
- Mini wallet balance preview
- Notification bell with badge
- Level indicator (optional)

**Accessibility:**
- Proper heading hierarchy
- Touch targets ≥44dp
- Screen reader optimized labels

```tsx
<PersonalizedHeader
  userName="John"
  walletBalance={125.50}
  currentStreak={7}
  streakGoal={30}
  unreadNotifications={3}
  onNotificationPress={() => router.push('/notifications')}
  onWalletPress={() => router.push('/wallet')}
/>
```

### 2. HeroRewardCard

**Purpose:** Prominent CTA for daily reward claiming with celebration animations.

**Features:**
- Large progress ring visualization
- Streak bonus display
- Animated claim button with pulse effect
- Confetti celebration on claim
- Countdown timer when unavailable

**Accessibility:**
- Clear state announcements
- Disabled state for screen readers
- High contrast colors

```tsx
<HeroRewardCard
  isAvailable={true}
  currentStreak={7}
  todayReward={150}
  streakBonus={50}
  onClaim={() => claimReward()}
/>
```

### 3. QuickActions

**Purpose:** Quick access to primary earning activities.

**Features:**
- 4 large icon buttons (Answer, Watch, Survey, Reward)
- Badge indicators for available items
- Gradient backgrounds per action type
- Scale animation on press
- Highlighted state for available rewards

**Accessibility:**
- Touch targets ≥56dp
- Clear labels and hints
- Toolbar role for grouping

```tsx
<QuickActions
  onAnswerQuestion={() => router.push('/questions')}
  onWatchVideo={() => router.push('/videos')}
  onTakeSurvey={() => router.push('/surveys')}
  onClaimReward={() => claimReward()}
  dailyRewardAvailable={true}
  availableQuestions={5}
  runningSurveys={3}
/>
```

### 4. EarningOpportunityCard

**Purpose:** Unified card design for different earning opportunities.

**Features:**
- Type indicators (Video, Survey, Question, Instant)
- Reward amount display
- Thumbnail or gradient placeholder
- Hot/New badges
- Duration and participant counts

```tsx
<EarningOpportunityCard
  opportunity={{
    id: 'video-1',
    type: 'video',
    title: 'Watch & Earn',
    reward: 50,
    rewardType: 'points',
    thumbnailUrl: '...',
    duration: '2:30',
    isHot: true,
  }}
  onPress={(opp) => navigate(opp)}
/>
```

### 5. Skeleton Loaders

**Purpose:** Smooth loading states for all components.

**Features:**
- Shimmer animation
- Component-specific shapes
- Reduced motion support
- Screen reader announcements

---

## Accessibility Improvements (WCAG 2.2 AA)

### Dynamic Type Support

All text components include:
```tsx
<Text
  allowFontScaling
  maxFontSizeMultiplier={1.3}
>
```

### Touch Targets

All interactive elements meet minimum 44x44dp:
```tsx
style={{
  minWidth: COMPONENT_SIZE.touchTarget, // 44
  minHeight: COMPONENT_SIZE.touchTarget,
}}
```

### Screen Reader

All components include proper accessibility props:
```tsx
accessibilityRole="button"
accessibilityLabel="Claim daily reward"
accessibilityHint="Tap to claim your daily reward of 150 points"
accessibilityState={{ disabled: isLoading }}
```

### Announcements

Important state changes are announced:
```tsx
AccessibilityInfo.announceForAccessibility("Daily reward claimed successfully!");
```

### Contrast Ratios

All text meets minimum 4.5:1 contrast ratio against backgrounds.

---

## Performance Optimizations

### FlatList Virtualization

```tsx
<FlatList
  data={sections}
  renderItem={renderSection}
  removeClippedSubviews={Platform.OS === "android"}
  maxToRenderPerBatch={5}
  updateCellsBatchingPeriod={50}
  windowSize={10}
  initialNumToRender={6}
/>
```

### Memoization

```tsx
const sections = useMemo(() => [...], [dependencies]);
const renderSection = useCallback(({ item }) => {...}, [dependencies]);
```

### Skeleton Loading

Initial load shows skeleton instead of spinner for perceived performance.

---

## Visual Design Tokens

### Spacing (4px base unit)
- `xs`: 4px
- `sm`: 8px
- `md`: 12px
- `base`: 16px
- `lg`: 20px
- `xl`: 24px

### Border Radius
- `md`: 8px
- `lg`: 16px
- `xl`: 20px
- `2xl`: 24px
- `full`: 9999px

### Shadows
- `sm`: Subtle elevation
- `md`: Card elevation
- `lg`: Hero elements

---

## Migration Guide

### From Old home.tsx

1. Import new components:
```tsx
import {
  PersonalizedHeader,
  HeroRewardCard,
  QuickActions,
  DashboardSkeleton,
} from '@/components/home';
```

2. Replace ScrollView with FlatList pattern (see `home-redesigned.tsx`)

3. Update section rendering to use new components

4. Add accessibility props to all interactive elements

### Gradual Migration

The new implementation is in `home-redesigned.tsx`. To switch:

1. Test the new implementation thoroughly
2. Rename `home.tsx` to `home-legacy.tsx`
3. Rename `home-redesigned.tsx` to `home.tsx`
4. Verify all navigation and data flows work correctly

---

## Testing Checklist

### Accessibility
- [ ] VoiceOver (iOS) navigation works correctly
- [ ] TalkBack (Android) navigation works correctly
- [ ] Dynamic type scaling doesn't break layout
- [ ] All touch targets are ≥44dp
- [ ] Color contrast meets 4.5:1 minimum

### Performance
- [ ] Initial load shows skeleton within 100ms
- [ ] Scroll is smooth at 60fps
- [ ] Pull-to-refresh works correctly
- [ ] Memory usage is stable during scroll

### Functionality
- [ ] Daily reward claiming works
- [ ] All navigation routes work
- [ ] Quick actions navigate correctly
- [ ] Ads load and track correctly
- [ ] Data refreshes on pull

---

## Future Enhancements

1. **Personalized Feed Algorithm** - ML-based content ranking
2. **Animations** - Lottie animations for celebrations
3. **Onboarding Hints** - Coach marks for new users
4. **Widget Support** - iOS/Android home screen widgets
5. **Haptic Patterns** - Custom haptic feedback patterns
