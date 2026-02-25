/**
 * Gated Haptics Utility — Drop-in replacement for `expo-haptics`
 *
 * All haptic calls are gated on the user's `hapticFeedbackEnabled` preference
 * from AppSettingsStore. Import this module instead of `expo-haptics` to
 * automatically respect the Quick Settings toggle.
 *
 * @example
 * ```ts
 * // Before (ungated):
 * import * as Haptics from 'expo-haptics';
 *
 * // After (gated):
 * import * as Haptics from '@/utils/haptics';
 *
 * // Same API — calls are silently skipped when haptics are disabled
 * Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 * ```
 */

import * as ExpoHaptics from 'expo-haptics';
import { useAppSettingsStore } from '@/store/AppSettingsStore';

// Re-export enums so `Haptics.ImpactFeedbackStyle` works as a drop-in replacement
export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

/** Gated `impactAsync` — respects hapticFeedbackEnabled setting. */
export async function impactAsync(
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Medium,
): Promise<void> {
  if (useAppSettingsStore.getState().hapticFeedbackEnabled) {
    return ExpoHaptics.impactAsync(style);
  }
}

/** Gated `notificationAsync` — respects hapticFeedbackEnabled setting. */
export async function notificationAsync(
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success,
): Promise<void> {
  if (useAppSettingsStore.getState().hapticFeedbackEnabled) {
    return ExpoHaptics.notificationAsync(type);
  }
}

/** Gated `selectionAsync` — respects hapticFeedbackEnabled setting. */
export async function selectionAsync(): Promise<void> {
  if (useAppSettingsStore.getState().hapticFeedbackEnabled) {
    return ExpoHaptics.selectionAsync();
  }
}
