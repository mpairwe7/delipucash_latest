# Contributing Guide

Guidelines for contributing to the DelipuCash codebase.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Project Conventions](#project-conventions)
- [Branch Workflow](#branch-workflow)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [File Organization](#file-organization)
- [Accessibility Requirements](#accessibility-requirements)

## Development Setup

See [Getting Started](../getting-started.md) for full setup instructions. Quick version:

```bash
# Backend
cd server && bun install && bun run dev

# Frontend
cd DelipuCash && bun install && npx expo start
```

## Code Style

### TypeScript

Both workspaces use TypeScript in strict mode:

- **Frontend:** `"strict": true` extending `expo/tsconfig.base`
- **Backend:** `"strict": true` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`

### Linting

```bash
# Frontend
cd DelipuCash && bun run lint

# Backend
cd server && bun run lint
```

Frontend uses `eslint-config-expo/flat`. Backend uses ESLint with standard configuration.

### General Rules

- Use `const` by default, `let` only when reassignment is necessary
- Prefer named exports over default exports (except screen components)
- Use early returns to reduce nesting
- Avoid `any` — use `unknown` and narrow with type guards
- Avoid `as` type assertions — prefer type-safe alternatives

## Project Conventions

### Frontend

| Convention | Pattern |
|-----------|---------|
| Screen files | `app/(tabs)/screen-name.tsx`, `app/screen-name.tsx` |
| Components | `components/category/ComponentName.tsx` |
| Hooks | `services/featureHooks.ts` (dedicated) or `hooks/useHookName.ts` |
| Stores | `store/featureStore.ts` — export selectors from `store/index.ts` |
| API modules | `services/api.ts` (central) or `services/featureApi.ts` |
| Path alias | `@/` maps to project root |

### State Management

| Data Type | Where | Pattern |
|-----------|-------|---------|
| Server data | TanStack Query | `useQuery` / `useInfiniteQuery` / `useMutation` |
| UI state | Zustand | Persisted via AsyncStorage where appropriate |
| Auth tokens | `expo-secure-store` | Never in Zustand or AsyncStorage |
| Ephemeral state | `useState` / `useRef` | Component-local only |

### Hook Conventions

- Prefer dedicated hook files (`videoHooks.ts`, `questionHooks.ts`) over the legacy `hooks.ts`
- All mutations should implement optimistic updates with rollback
- Use `useCallback` for handlers passed to memoized children
- Use `useMemo` for derived data computed from query results
- Use refs for values read in callbacks but that shouldn't trigger re-renders

### Component Conventions

- All FlatList items must use `React.memo`
- Extract stable handler functions (ID-based, not closure-based)
- Cap entering animations: `MAX_ANIMATED_INDEX = 8`
- Every interactive element needs `accessibilityRole` and `accessibilityLabel`
- Minimum 44x44dp touch targets

### Backend

| Convention | Pattern |
|-----------|---------|
| Route files | `routes/featureRoutes.js` |
| Controllers | `controllers/featureController.js` |
| Middleware | `lib/middleware.js` or feature-specific middleware |
| Prisma queries | Use `_count` aggregate over manual counting |
| Auth | Protected routes use `verifyToken` middleware; `req.user.id` for identity |

## Branch Workflow

```
main ← production branch, auto-deploys to Vercel
  ├── feature/short-description ← new features
  ├── fix/short-description ← bug fixes
  └── refactor/short-description ← refactoring
```

1. Create a branch from `main`
2. Make your changes
3. Push and open a Pull Request
4. Get review approval
5. Merge to `main` (triggers auto-deploy)

## Commit Messages

Follow conventional commit format:

```
type: short description

Optional longer description explaining the "why"
```

### Types

| Type | Use |
|------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons (no code change) |
| `test` | Adding or updating tests |
| `chore` | Build, deps, config changes |

### Examples

```
feat: add round-robin interstitial ad selection
fix: prevent bookmark API call on sponsored video items
perf: defer ad hooks until feed finishes loading
refactor: consolidate 3 ad hooks into useScreenAds
```

## Pull Requests

### PR Title

- Under 70 characters
- Start with the type: `feat: ...`, `fix: ...`, etc.

### PR Body

```markdown
## Summary
- Brief description of what changed and why

## Test Plan
- [ ] Manual testing steps
- [ ] Edge cases verified
```

### Checklist

Before requesting review:

- [ ] TypeScript compiles without errors
- [ ] ESLint passes (`bun run lint`)
- [ ] Tested on Android device/emulator
- [ ] Tested on iOS simulator (if applicable)
- [ ] No `console.log` left in production code
- [ ] No hardcoded API URLs (use env vars)
- [ ] Accessibility labels on new interactive elements
- [ ] Optimistic updates for new mutations
- [ ] `React.memo` on new list item components

## File Organization

### Prefer Editing Over Creating

- Edit existing files before creating new ones
- Add new hooks to existing hook files (`videoHooks.ts`, etc.) before creating a new file
- Add new components to existing directories before creating new directories

### Avoid Over-Engineering

- Don't add features beyond what was requested
- Don't create abstractions for one-time operations
- Don't add error handling for impossible scenarios
- Three similar lines of code is better than a premature abstraction
- Don't add comments to self-evident code

### Avoid Unnecessary Files

- Don't create documentation files unless explicitly requested
- Don't create config files unless needed for a new tool
- Don't create type definition files for simple types — co-locate with usage

## Accessibility Requirements

All UI changes must meet WCAG 2.2 AA:

| Requirement | Standard |
|-------------|----------|
| Touch targets | Minimum 44x44dp |
| Color contrast (normal text) | 4.5:1 ratio |
| Color contrast (large text) | 3:1 ratio |
| Interactive elements | `accessibilityRole` + `accessibilityLabel` |
| State changes | `accessibilityState` (selected, disabled, etc.) |
| Important actions | `AccessibilityInfo.announceForAccessibility()` |
| Reduced motion | Respect `isReduceMotionEnabled()` |

## Related

- [Testing Guide](testing.md) — Testing setup and conventions
- [Frontend README](../frontend/README.md) — Frontend architecture
- [Backend README](../backend/README.md) — Backend architecture
- [Performance Guide](../frontend/performance.md) — Performance patterns to follow
