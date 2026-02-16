/**
 * Silent token refresh with promise coalescing.
 *
 * When the access token expires (401), any number of concurrent callers
 * can call `silentRefresh()`. Only ONE network request fires; all callers
 * await the same promise.
 *
 * On success: updates AuthStore + SecureStore with new tokens.
 * On failure: clears auth (forces re-login).
 */

import { useAuthStore, type AuthData } from '@/utils/auth/store';
import { API_ROUTES } from './api';

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';
const apiBase = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');

// Module-level coalescing state
let refreshPromise: Promise<AuthData | null> | null = null;

/**
 * Perform a silent refresh. Returns the new AuthData on success, null on failure.
 * If a refresh is already in-flight, piggybacks on the existing promise.
 */
export async function silentRefresh(): Promise<AuthData | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function doRefresh(): Promise<AuthData | null> {
  const auth = useAuthStore.getState().auth;
  if (!auth?.refreshToken) {
    useAuthStore.getState().setAuth(null);
    return null;
  }

  try {
    const res = await fetch(`${apiBase}${API_ROUTES.auth.refreshToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    });

    if (!res.ok) {
      // Refresh failed — force re-login
      useAuthStore.getState().setAuth(null);
      return null;
    }

    const data = await res.json();

    const newAuth: AuthData = {
      token: data.token,
      refreshToken: data.refreshToken,
      user: auth.user, // user data unchanged
    };

    useAuthStore.getState().setAuth(newAuth);
    return newAuth;
  } catch {
    useAuthStore.getState().setAuth(null);
    return null;
  }
}

/**
 * Check if a response status indicates an expired access token (client should refresh).
 */
export function isTokenExpiredResponse(status: number): boolean {
  return status === 401;
}
