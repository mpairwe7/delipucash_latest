# Design System

**File:** `utils/theme.ts`

## Table of Contents

- [Design Tokens](#design-tokens)
- [Color System](#color-system)
- [Typography](#typography)
- [Spacing](#spacing)
- [Theme Hook](#theme-hook)
- [Accessibility](#accessibility)

## Design Tokens

### Spacing Scale

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `SPACING.xxs` | 2px | Hairline gaps |
| `SPACING.xs` | 4px | Tight spacing |
| `SPACING.sm` | 8px | Small gaps |
| `SPACING.md` | 12px | Medium gaps |
| `SPACING.lg` | 16px | Standard spacing |
| `SPACING.xl` | 20px | Section gaps |
| `SPACING.xxl` | 24px | Large gaps |
| `SPACING['3xl']` | 32px | Section padding |
| `SPACING['4xl']` | 40px | Large sections |
| `SPACING['5xl']` | 56px | Hero spacing |
| `SPACING['6xl']` | 80px | Maximum spacing |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `RADIUS.none` | 0 | No rounding |
| `RADIUS.xs` | 4px | Subtle rounding |
| `RADIUS.sm` | 8px | Small elements |
| `RADIUS.md` | 12px | Cards |
| `RADIUS.lg` | 16px | Modals |
| `RADIUS.xl` | 20px | Large cards |
| `RADIUS.xxl` | 24px | Prominent elements |
| `RADIUS.full` | 9999px | Pills, circles |

### Icon Sizes

| Token | Value |
|-------|-------|
| `ICON_SIZE.xs` | 12px |
| `ICON_SIZE.sm` | 16px |
| `ICON_SIZE.md` | 20px |
| `ICON_SIZE.lg` | 24px |
| `ICON_SIZE.xl` | 32px |
| `ICON_SIZE.xxl` | 48px |

### Shadows

Platform-specific shadow implementation:

```typescript
// iOS
SHADOWS.sm = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
};

// Android
SHADOWS.sm = {
  elevation: 2,
};
```

Levels: `sm`, `md`, `lg`, `xl`

### Z-Index Stack

| Token | Value | Usage |
|-------|-------|-------|
| `Z_INDEX.base` | 0 | Default |
| `Z_INDEX.dropdown` | 10 | Dropdowns |
| `Z_INDEX.sticky` | 20 | Sticky headers |
| `Z_INDEX.overlay` | 30 | Overlays |
| `Z_INDEX.modal` | 40 | Modals |
| `Z_INDEX.toast` | 50 | Toast notifications |

## Color System

### Light Theme

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | #007AFF | Primary brand color |
| `background` | #FFFFFF | Screen background |
| `card` | #F8F9FA | Card background |
| `text` | #1A1A2E | Primary text |
| `textSecondary` | #6B7280 | Secondary text |
| `border` | #E5E7EB | Borders and dividers |
| `success` | #10B981 | Success states |
| `warning` | #F59E0B | Warning states |
| `error` | #EF4444 | Error states |
| `info` | #3B82F6 | Informational |

### Dark Theme

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | #007AFF | Primary (same) |
| `background` | #000000 | Screen background |
| `card` | #1A1A1A | Card background |
| `text` | #F9FAFB | Primary text |
| `textSecondary` | #9CA3AF | Secondary text |
| `border` | #374151 | Borders |
| `success` | #10B981 | Success (same) |
| `warning` | #F59E0B | Warning (same) |
| `error` | #EF4444 | Error (same) |

### Tab Colors

| Token | Light | Dark |
|-------|-------|------|
| `tabActive` | #007AFF | #FFFFFF |
| `tabInactive` | #6B7280 | #9CA3AF |

## Typography

**Font Family:** Roboto (loaded via `@expo-google-fonts/roboto`)

| Weight | Font | Usage |
|--------|------|-------|
| 400 | Roboto_400Regular | Body text |
| 500 | Roboto_500Medium | Emphasis, labels |
| 700 | Roboto_700Bold | Headings, CTAs |

### Font Sizes

| Token | Size | Line Height |
|-------|------|-------------|
| `xs` | 10px | 14px |
| `sm` | 12px | 16px |
| `base` | 14px | 20px |
| `md` | 16px | 22px |
| `lg` | 18px | 26px |
| `xl` | 20px | 28px |
| `2xl` | 24px | 32px |
| `3xl` | 30px | 36px |
| `4xl` | 36px | 40px |
| `5xl` | 48px | 52px |

## Theme Hook

```typescript
const { colors, typography, spacing, isDark, statusBarStyle, colorScheme } = useTheme();
```

### `withAlpha(color, alpha)`

Adds transparency to any RGB color:

```typescript
withAlpha(colors.text, 0.5);  // "rgba(26, 26, 46, 0.5)"
withAlpha('#007AFF', 0.1);    // "rgba(0, 122, 255, 0.1)"
```

### `useColorScheme()`

Returns the system color scheme preference ('light' | 'dark').

## Accessibility

### Reduced Motion

```typescript
// Check system preference
const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();

// Listen for changes
AccessibilityInfo.addEventListener('reduceMotionChanged', handler);
```

When reduced motion is enabled:

- Animations use duration 0 or are replaced with opacity fades
- Parallax effects are disabled
- Auto-playing carousels stop

### Touch Targets

All interactive elements maintain a minimum 44x44dp touch area (WCAG 2.2 AA).

### Color Contrast

- Normal text: minimum 4.5:1 contrast ratio
- Large text: minimum 3:1 contrast ratio
- Both light and dark themes meet WCAG AA requirements

### Screen Reader Support

```typescript
// All interactive elements
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Like this video"
  accessibilityState={{ selected: isLiked }}
>
```

Important state changes use announcements:

```typescript
AccessibilityInfo.announceForAccessibility('Answer correct! You earned 500 UGX');
```
