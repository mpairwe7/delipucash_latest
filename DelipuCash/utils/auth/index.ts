/**
 * Auth module exports
 * 
 * @description Centralized exports for authentication utilities.
 * Import from this file for cleaner imports in your components.
 * 
 * @example
 * ```tsx
 * import { useAuth, useUser, useRequireAuth } from '@/utils/auth';
 * ```
 */

export { useAuth, useRequireAuth } from "./useAuth";
export { useUser } from "./useUser";
export { useAuthStore, useAuthModal, authKey } from "./store";
export { AuthModal } from "./useAuthModal";
export { AuthWebView } from "./AuthWebView";

// Type exports
export type {
  AuthUser,
  AuthData,
  AuthState,
  AuthMode,
  AuthModalState,
  OpenAuthModalOptions,
} from "./store";

export type { UseAuthResult, RequireAuthOptions } from "./useAuth";
export type { UseUserResult } from "./useUser";
export type { AuthWebViewProps } from "./AuthWebView";
export type { AuthModalProps } from "./useAuthModal";

// Default export
export { useAuth as default } from "./useAuth";
