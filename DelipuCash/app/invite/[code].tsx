/**
 * /invite/[code] — referral deep-link landing inside the app.
 *
 * Stashes the code in AsyncStorage so the signup screen picks it up on submit,
 * then routes:
 *   - signed in → home (we don't credit existing users for someone else's invite)
 *   - signed out → signup, with the code preloaded
 */

import { Redirect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { useAuth } from '@/utils/auth/useAuth';

const PENDING_KEY = 'pendingReferralCode';

export default function InviteRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (typeof code === 'string' && /^[A-Za-z0-9]{4,16}$/.test(code)) {
      AsyncStorage.setItem(PENDING_KEY, code.toUpperCase()).catch(() => {});
    }
  }, [code]);

  if (!isReady) return null; // wait for SecureStore restore

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home-redesigned" />;
  }
  return <Redirect href="/(auth)/signup" />;
}
