# Architecture Decision Records

Use this template when making significant architectural decisions. Save each ADR as a new file in this directory (e.g., `001-state-management.md`).

## Template

```markdown
# ADR-NNN: [Title]

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNN

**Date:** YYYY-MM-DD

**Authors:** [Names]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive

- ...

### Negative

- ...

### Neutral

- ...
```

---

## Example: ADR-001 — State Separation (Zustand + TanStack Query)

**Status:** Accepted

**Date:** 2026-01-15

**Authors:** Engineering team

### Context

The app needs to manage both UI state (tab selection, form drafts, modal visibility) and server state (API data, cache invalidation, background sync). Using a single state management solution for both creates coupling, stale data bugs, and unnecessary complexity.

### Decision

- **Zustand** for client-only UI state — persisted to AsyncStorage where needed
- **TanStack Query** for server state — handles caching, background refetch, optimistic updates
- **SecureStore** for sensitive auth tokens — encrypted, not in Zustand or AsyncStorage
- Stores never fetch data — they hold UI preferences. Data fetching is TanStack Query's responsibility.

### Consequences

**Positive:**

- Clear separation of concerns — UI bugs don't affect data, data bugs don't affect UI
- TanStack Query handles cache invalidation, stale time, and background refetch automatically
- Zustand stores stay small and focused (typically < 100 lines each)
- Offline support is straightforward — Zustand queues, TanStack Query retries

**Negative:**

- Developers must understand two state systems
- Some state lives in both (e.g., liked video IDs in Zustand for optimistic UI, canonical state in TanStack Query cache)

**Neutral:**

- Total of 15 Zustand stores, which is manageable given the app's feature scope
