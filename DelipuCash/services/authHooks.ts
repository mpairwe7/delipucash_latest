/**
 * Auth TanStack Query Hooks
 *
 * Centralized mutation hooks for all auth network actions.
 * Replaces ad-hoc fetch calls with proper mutation lifecycle:
 * - Automatic retry, cancellation, deduping
 * - Consistent pending/success/error state
 * - Shared error mapping
 *
 * Uses the canonical API_BASE_URL from api.ts — no env drift.
 */

import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { API_ROUTES } from './api';
import {
  AuthData,
  AuthResponse,
  LoginCredentials,
  SignupCredentials,
  useAuthStore,
  useAuthModal,
} from '@/utils/auth/store';
// ============================================================================
// CANONICAL API BASE URL — single source of truth
// ============================================================================

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';
/** Canonical API origin. All auth calls use this — no EXPO_PUBLIC_BASE_URL drift. */
export const AUTH_API_BASE = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');

// ============================================================================
// FETCH HELPER
// ============================================================================

class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${AUTH_API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthApiError(
      data?.message || data?.error || 'Request failed',
      response.status
    );
  }

  return data as T;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface LoginResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: AuthData['user'];
  twoFactorRequired?: boolean;
  maskedEmail?: string;
}

interface SignupResponse {
  success: boolean;
  message: string;
  token: string;
  refreshToken: string;
  user: AuthData['user'];
}

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

interface ValidateTokenResponse {
  valid: boolean;
}

interface TwoFactorSendResponse {
  success: boolean;
  message: string;
  maskedEmail?: string;
  expiresAt?: string;
}

interface TwoFactorVerifyLoginResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: AuthData['user'];
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Login mutation with 2FA branch detection.
 * On success: stores auth data in Zustand + SecureStore.
 * If `twoFactorRequired` is true in response, caller should enter 2FA flow.
 */
export function useLoginMutation(): UseMutationResult<
  LoginResponse,
  AuthApiError,
  LoginCredentials
> {
  const setAuth = useAuthStore(s => s.setAuth);
  const close = useAuthModal(s => s.close);
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['auth', 'login'],
    mutationFn: (credentials: LoginCredentials): Promise<LoginResponse> =>
      authFetch<LoginResponse>(API_ROUTES.auth.login, {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      }),
    onSuccess: (data) => {
      // Only persist auth if NOT a 2FA-required response
      if (!data.twoFactorRequired && data.token && data.user) {
        setAuth({ token: data.token, refreshToken: data.refreshToken, user: data.user });
        close();

        // Invalidate all cached queries so every screen fetches fresh data
        // for the newly authenticated user (profile, surveys, rewards, etc.)
        queryClient.invalidateQueries();
      }
    },
    retry: false, // Don't auto-retry auth
  });
}

/**
 * Signup mutation.
 * Normalizes phone → backend expects `phone` field.
 *
 * 2026 best practice: Signup does NOT auto-login. The user is redirected to
 * the login screen so they explicitly authenticate. This ensures:
 * - Email verification flow can be added without breaking UX
 * - Users confirm their credentials immediately
 * - Cleaner session lifecycle (all sessions start from login)
 */
export function useSignupMutation(): UseMutationResult<
  SignupResponse,
  AuthApiError,
  SignupCredentials
> {
  const close = useAuthModal(s => s.close);

  return useMutation({
    mutationKey: ['auth', 'signup'],
    mutationFn: (credentials: SignupCredentials): Promise<SignupResponse> =>
      authFetch<SignupResponse>(API_ROUTES.auth.register, {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          firstName: credentials.firstName || '',
          lastName: credentials.lastName || '',
          phone: credentials.phoneNumber || credentials.phone || '',
        }),
      }),
    onSuccess: () => {
      // Do NOT auto-login: close modal and let the caller redirect to login
      close();
    },
    retry: false,
  });
}

/**
 * Forgot password mutation.
 * Uses canonical AUTH_API_BASE — no EXPO_PUBLIC_BASE_URL drift.
 */
export function useForgotPasswordMutation(): UseMutationResult<
  ForgotPasswordResponse,
  AuthApiError,
  { email: string }
> {
  return useMutation({
    mutationKey: ['auth', 'forgotPassword'],
    mutationFn: ({ email }: { email: string }) =>
      authFetch<ForgotPasswordResponse>(API_ROUTES.auth.forgotPassword, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    retry: false,
  });
}

/**
 * Validate reset token mutation.
 */
export function useValidateResetTokenMutation(): UseMutationResult<
  ValidateTokenResponse,
  AuthApiError,
  { token: string; email: string }
> {
  return useMutation({
    mutationKey: ['auth', 'validateResetToken'],
    mutationFn: ({ token, email }: { token: string; email: string }) =>
      authFetch<ValidateTokenResponse>(API_ROUTES.auth.validateResetToken, {
        method: 'POST',
        body: JSON.stringify({ token, email }),
      }),
    retry: false,
  });
}

/**
 * Reset password mutation.
 */
export function useResetPasswordMutation(): UseMutationResult<
  ResetPasswordResponse,
  AuthApiError,
  { token: string; email: string; newPassword: string }
> {
  return useMutation({
    mutationKey: ['auth', 'resetPassword'],
    mutationFn: (payload: { token: string; email: string; newPassword: string }) =>
      authFetch<ResetPasswordResponse>(API_ROUTES.auth.resetPassword, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    retry: false,
  });
}

/**
 * Send 2FA login code (public endpoint — during login flow).
 */
export function useSend2FACodeMutation(): UseMutationResult<
  TwoFactorSendResponse,
  AuthApiError,
  { email: string }
> {
  return useMutation({
    mutationKey: ['auth', '2fa', 'send'],
    mutationFn: ({ email }: { email: string }) =>
      authFetch<TwoFactorSendResponse>(API_ROUTES.auth.twoFactorSend, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    retry: false,
  });
}

/**
 * Verify 2FA login code (completes login, returns JWT).
 */
export function useVerify2FALoginMutation(): UseMutationResult<
  TwoFactorVerifyLoginResponse,
  AuthApiError,
  { email: string; code: string }
> {
  const setAuth = useAuthStore(s => s.setAuth);
  const close = useAuthModal(s => s.close);

  return useMutation({
    mutationKey: ['auth', '2fa', 'verifyLogin'],
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      authFetch<TwoFactorVerifyLoginResponse>(API_ROUTES.auth.twoFactorVerifyLogin, {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      }),
    onSuccess: (data) => {
      if (data.token && data.user) {
        setAuth({ token: data.token, refreshToken: data.refreshToken, user: data.user });
        close();
      }
    },
    retry: false,
  });
}
