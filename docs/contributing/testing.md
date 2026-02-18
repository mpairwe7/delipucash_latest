# Testing Guide

Testing setup, conventions, and manual testing checklists for the DelipuCash project.

## Table of Contents

- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [Manual Testing Checklists](#manual-testing-checklists)

## Backend Testing

### Runner

The backend uses **Bun's built-in test runner**:

```bash
cd server
bun test
```

### File Locations

Test files live alongside the code they test or in a dedicated `__tests__/` directory:

```
server/
├── controllers/
│   └── __tests__/
├── lib/
│   └── __tests__/
└── utils/
    └── __tests__/
```

### Writing Tests

```typescript
import { describe, it, expect } from 'bun:test';

describe('formatRewardQuestionPublic', () => {
  it('strips correctAnswer from public response', () => {
    const question = {
      id: '1',
      title: 'Test',
      correctAnswer: 'Option A',
      phoneNumber: '+256700000001',
    };

    const result = formatRewardQuestionPublic(question);

    expect(result.correctAnswer).toBeUndefined();
    expect(result.phoneNumber).toBeUndefined();
    expect(result.id).toBe('1');
  });
});
```

### Conventions

- Test file naming: `featureName.test.ts`
- Use `describe` blocks to group related tests
- Test the public API of modules, not internal implementation
- Mock external services (database, payment APIs, email) in tests
- Use the Prisma singleton for database tests (with transaction rollback)

### Running

```bash
# All tests
bun test

# Specific file
bun test controllers/__tests__/questions.test.ts

# Watch mode
bun test --watch
```

## Frontend Testing

### Current State

The frontend primarily relies on TypeScript type checking and ESLint for static analysis, with manual testing on devices/emulators for runtime behavior.

```bash
# Type checking
cd DelipuCash
npx tsc --noEmit

# Linting
bun run lint
```

### Component Testing Recommendations

For components that warrant automated tests, use the React Native Testing Library pattern:

```typescript
import { render, fireEvent } from '@testing-library/react-native';

describe('QuestionCard', () => {
  it('calls onPress with question ID', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <QuestionCard question={mockQuestion} onPress={onPress} />
    );

    fireEvent.press(getByText(mockQuestion.title));
    expect(onPress).toHaveBeenCalledWith(mockQuestion.id);
  });
});
```

### Hook Testing Recommendations

For custom hooks, use `renderHook` from React Testing Library:

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';

describe('useQuestionsFeed', () => {
  it('returns paginated questions for the active tab', async () => {
    const { result } = renderHook(() => useQuestionsFeed('trending'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

## Manual Testing Checklists

### Authentication Flow

- [ ] Sign up with new email — receives tokens, navigates to home
- [ ] Sign in with existing credentials — receives tokens
- [ ] Sign in with wrong password — shows error
- [ ] Token refresh — silent refresh after token expiry (no logout)
- [ ] 2FA enable — sends OTP to email, verifies, enables
- [ ] 2FA login — prompts for OTP after password
- [ ] Forgot password — sends reset email, reset link works
- [ ] Sign out — clears tokens, redirects to auth screen

### Question Feed

- [ ] Feed loads with "For You" tab selected by default
- [ ] Switching tabs (Trending, Recent) fetches correct data
- [ ] Pull-to-refresh reloads feed
- [ ] Infinite scroll loads next page
- [ ] Tab persists across screen focus changes
- [ ] No content flash when switching tabs (keepPreviousData)
- [ ] FadeIn animation only on first 8 items
- [ ] Skeleton loader shows while initial data loads

### Question Detail

- [ ] Navigate to detail — shows question and responses
- [ ] Submit response — optimistic update, appears instantly
- [ ] Vote (upvote/downvote) — updates count immediately
- [ ] Like/dislike response — count updates
- [ ] Reply to response — nested reply appears

### Video Feed

- [ ] Vertical scroll plays/pauses videos based on visibility
- [ ] Like — heart animation, count increments
- [ ] Bookmark — icon toggles, persists
- [ ] Comment — opens bottom sheet, submit adds comment
- [ ] Share — opens share sheet
- [ ] Sponsored video — shows ad label, no bookmark/like API calls
- [ ] Interstitial ad — shows after N videos, round-robin selection
- [ ] Session ad cap — no more ads after hitting limit (8)
- [ ] Mini player — appears when navigating away from video tab

### Reward Questions

- [ ] Regular questions list — paginated, loads correctly
- [ ] Instant questions list — paginated, loads correctly
- [ ] Answer question — correct answer shows reward notification
- [ ] Answer question — incorrect answer shows correct answer
- [ ] Already attempted — shows "already attempted" message
- [ ] Offline — queues submission, flushes when online

### Payments & Redemption

- [ ] Redeem points — shows provider selection (MTN/Airtel)
- [ ] Enter phone number — validates format
- [ ] Submit redemption — deducts points, shows success
- [ ] Insufficient points — shows error, no deduction
- [ ] Payment failure — refunds points, shows error

### Ads

- [ ] Feed ads appear at configured intervals
- [ ] Ad impression tracking fires on viewability threshold
- [ ] Ad click opens URL and records click
- [ ] Frequency cap — no more ads after limit
- [ ] User fatigue — reduces ad frequency after dismissals
- [ ] No ads in checkout context

### Offline Behavior

- [ ] App shows cached data when offline
- [ ] Pending submissions queue when offline
- [ ] Queue flushes when connection restored
- [ ] Network error toast shows for failed requests

### Accessibility

- [ ] Screen reader announces interactive elements correctly
- [ ] All buttons have accessibility labels
- [ ] Touch targets are at least 44x44dp
- [ ] Color contrast meets 4.5:1 for normal text
- [ ] Reduced motion disables animations

### Performance Checks

- [ ] Feed scrolling maintains 60fps (no jank)
- [ ] Tab switching is instant (no flash)
- [ ] No unnecessary re-renders (React DevTools Profiler)
- [ ] Memory doesn't grow unbounded during long sessions
- [ ] Images/videos don't load off-screen (`removeClippedSubviews`)

## Related

- [Contributing Guide](README.md) — Code style and PR process
- [Performance Guide](../frontend/performance.md) — Performance optimization patterns
- [API Reference](../backend/api-reference.md) — Endpoint reference for testing
