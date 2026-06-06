# Question & survey screen regression suite

UI-consistency, accessibility, performance, and visual regression tests for the **Core Q&A
screens** and the **survey screens**, using 2026 React Native testing standards. Before this
suite the app had no UI/perf test coverage — only two pure-logic store tests.

## What's covered

| Screen / unit | File | Asserts |
| --- | --- | --- |
| Shared presentational components | `ui/question-detail-layout.ui.test.tsx` | `ResponseCard`, `QuestionHeroCard`, `QuestionDetailHeader`, `QuestionDetailError`, `AnswerInput`, `transformResponses` — structure, a11y roles/labels, validity gating, + narrow snapshots |
| `question-detail.tsx` (Discussion) | `ui/question-detail.ui.test.tsx` | loading / error+retry / loaded / empty states, responses list a11y, answer submission |
| `question-answer/[id].tsx` (Quora-style) | `ui/question-answer.ui.test.tsx` | states, count-labelled responses list, draft-store validity gating + submit |
| `(tabs)/questions-new.tsx` (feed) | `ui/questions-new.ui.test.tsx` | header/search/FAB a11y, loaded/loading/empty/error, 5 tabs, tab switch refetch |
| `(tabs)/surveys-new.tsx` (feed) | `ui/surveys-new.ui.test.tsx` | header/search a11y, loading/empty/loaded, 5 tabs, tab switch |
| `SurveyCard` (survey feed item) | `ui/survey-components.ui.test.tsx` | structure, `Survey:` a11y label, owner "view responses" action, + snapshots (fake-clock pinned) |
| `survey/[id].tsx` (take screen) | `ui/survey-take.ui.test.tsx` | loading / already-attempted / unavailable / loaded states, required-field gating, step navigation, **conditional-logic question hiding**, review→submit→success overlay |
| `survey-responses/[id].tsx` (owner) | `ui/survey-responses.ui.test.tsx` | loading / access-denied / loaded states, response-count a11y label, export action, the three Summary/Questions/Individual view tabs |
| Survey conditional-logic engine | `utils/conditionalLogic.test.ts` | pure unit tests for `evaluateCondition`/`evaluateConditions`/`isQuestionVisible`/`getVisibleQuestions`/`validateConditionalLogic` across every operator (AND/OR, equals, contains, numeric, empty) |
| Performance (Profiler) | `perf/*.perf.test.tsx` | commit-count baselines: AnswerInput typing, questions/surveys feed initial + tab switch, question-detail typing, survey-take initial + advance + per-keystroke |
| Visual (Storybook + Playwright) | `stories/*.stories.tsx`, `e2e-visual/component-stories.spec.ts` | pixel screenshots of the presentational components (question + survey card + survey charts) diffed against committed baselines; animated stories (skeletons) are tagged `dynamic` → mounted as a render smoke-test, not pixel-diffed |

## Running

```bash
bun run test                  # all tests: unit + UI + a11y + snapshot + perf (commit-count)
bun run test:ci               # same, CI mode (hard gate)
bun run test:update-snapshots # intentionally re-baseline narrow snapshots
bunx jest <path> -t "<name>"  # focus a single file / test

bun run storybook             # browse the question component stories (dev)
bun run test:visual           # build Storybook + pixel-diff stories vs baselines
bun run test:visual:update    # (re)generate the committed visual baselines
```

Maestro e2e smoke (non-gating, needs emulator + dev build):

```bash
maestro test .maestro/questions-smoke.yaml
```

## How it works

- **`jest.setup.ts`** (`setupFilesAfterEnv`) — global native-module mocks (reanimated,
  AsyncStorage, Sentry, expo media/haptics/status-bar, lucide icons, RevenueCat/maps,
  React Navigation focus hooks, push-notification context). Mirrors the existing
  `jest.mock(path, factory)` idiom.
- **`test-utils/`** — `renderWithProviders` (SafeAreaProvider + QueryClientProvider; the
  theme is Zustand-backed so needs no provider), `createProvidersWrapper` (reused as the
  Reassure `wrapper`), `createTestQueryClient`.
- **`__tests__/fixtures/question.factory.ts`** — deterministic `Question` / `Response` /
  feed-page / infinite-feed builders (fixed ids + dates so snapshots stay stable).
- **`__tests__/fixtures/survey.factory.ts`** — deterministic `Survey` builders: feed cards,
  `makeSurveyWithQuestions` (a survey whose `uploads` are the take-screen questions),
  `makeUploadSurvey`, the `useSurvey` / `useCheckSurveyAttempt` query mocks, and `makeResponseData`
  (the owner screen's `useSurveyResponseData` aggregate).
- Per-screen tests mock only the data-hook surface (`@/services/questionHooks` etc.) and
  `expo-router`; everything else renders for real.

## Baselines & gating

- **Snapshots:** committed under `ui/__snapshots__/`. They cover only small, deterministic
  presentational subtrees (date/currency are pinned) — never whole screens, to avoid
  brittleness. CI fails if they change unintentionally; re-baseline with
  `test:update-snapshots`.
- **Performance (commit-count):** the `perf/*.perf.test.tsx` tests wrap each screen in a
  React `<Profiler>` and assert the number of commits an interaction costs (initial render,
  per-keystroke, tab switch) against measured baselines + a small margin. These are
  deterministic (not wall-clock), so they run inside the normal `test:ci` hard gate.
  *Why not Reassure:* `reassure@1.4`'s `measureRenders` hangs under React 19.1.0 + jest-expo
  (React 19 deprecated `react-test-renderer` and its measure loop never resolves). The
  Profiler approach gives equivalent render-regression coverage without that dependency —
  see `test-utils/renderWithProfiler.tsx`.
- **Visual (pixel) regression:** Storybook renders the presentational components in
  react-native-web (`.storybook/`, `stories/`); Playwright screenshots each story and diffs
  it against committed baselines in `e2e-visual/__screenshots__/<platform>/`. The
  `.storybook/stubs/native-stub.tsx` aliases native-only modules (RevenueCat, maps, video,
  camera, webview, **expo-router/status-bar/haptics** — which ship CJS) so the web build
  works. **Pixel baselines are OS-/font-specific**: regenerate them in the same environment
  as CI (the pinned `mcr.microsoft.com/playwright` container — see the repo-root
  `.github/workflows/visual.yml`) with `bun run test:visual:update`, then commit. That CI
  `visual` job is advisory (`continue-on-error`) until in-container baselines are committed.

> CI note: this is a monorepo. Mobile tests are gated by the repo-root
> `.github/workflows/ci.yml` (`mobile-typecheck-lint` + `mobile-test`, which runs Jest —
> including the snapshot and Profiler perf tests); visual regression runs in
> `.github/workflows/visual.yml`.

## UI-consistency & performance findings

Observed while building the suite; the tests now lock each so they can't silently drift:

1. **Three divergent "question detail" renderings** — `question-detail.tsx` ("Discussion")
   and `question-answer/[id].tsx` (Quora-style), plus the legacy `question/[id].tsx`
   redirect. Same entity, different UI per route. Each screen's contract is now asserted so
   divergence stays intentional. *Consider consolidating onto `QuestionDetailLayout`.*
2. **Inconsistent state-handling shape** — the feed folds loading/error/empty into one
   `ListEmptyComponent`; `question-detail.tsx` uses early returns + an inline empty view.
   Same three states, three structures.
3. **Per-screen FlatList tuning differs** with no documented rationale (feed
   `maxToRenderPerBatch=3, updateCellsBatchingPeriod=300`; detail `maxToRenderPerBatch=8`).
   The Reassure baseline makes future changes measurable.
4. **Top-level draft state re-renders the whole detail list per keystroke** —
   `question-detail.tsx` keeps `text` in screen-level `useState`, so each character
   re-renders the `FlatList`. Guarded by `perf/question-detail.perf-test.tsx`. *Consider
   isolating the input (the shared `AnswerInput` is already memoized — the answer screen
   uses a draft store, the discussion screen does not).*
5. **Accessibility is strong but worth locking** — labelled search/FAB/list/inputs; the
   `ResponseCard` like/dislike row renders only when handlers are passed. All asserted.

## Survey coverage notes

- **Conditional logic is locked at two levels.** The pure engine (`utils/conditionalLogic.ts`) is
  unit-tested operator-by-operator; the take screen test then asserts the *integration* — a gated
  question is absent until its source answer satisfies the rule, at which point the visible-question
  count and step chips update. Same behaviour, two safety nets.
- **Single-attempt enforcement** (`useCheckSurveyAttempt`) is its own state — "Already Completed"
  is asserted so the gate can't silently regress.
- **The completion overlay is intentionally not an isolated Storybook story.** It is service-coupled
  (`useRunningSurveys`, `configHooks`, `useUser`, a `QueryClient`, confetti/reanimated), so an
  isolated web story would need ~7 stubs and risk the visual build. Its success branch is instead
  exercised by the take-screen submit flow (the overlay is stubbed to a props renderer that surfaces
  the awarded points).
- **Native deps stubbed for surveys** (added to `jest.setup.ts`): `@react-native-community/datetimepicker`
  (date/time questions on the take screen), `expo-print` + `expo-sharing` (owner export). The owner
  screen's `SurveyCharts` are stubbed in jest, but rendered for real in Storybook.
- **Visual layer.** `SurveyCharts` (StatCard / Bar / Pie / Rating / Boolean / WordCloud) are pure
  View/Text — no SVG, no animation — so they make deterministic pixel baselines (the survey analog of
  the question presentational baselines). Loading skeletons use a looping shimmer, so their stories
  carry a `dynamic` tag and are mounted as a render smoke-test only (no flaky pixel baseline).

## Note: pre-existing test fix

`instantRewardStore.test.ts`'s `selectAttemptedCount` test was **already failing on `main`**
(unrelated to this work): it passed `attemptHistory` as a `{q1,q2,q3}` map, but the current
selector reads `attemptHistory.totalQuestionsAttempted`. Fixed to match the current store
contract so the baseline (and CI) start green.
