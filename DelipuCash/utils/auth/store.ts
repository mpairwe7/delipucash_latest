import type { AppUser } from "@/types";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

/**
 * Authentication key for secure storage
 */
export const authKey = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID}-jwt`;

/**
 * Authentication data structure
 */
export interface AuthData {
  /** JWT token or access token */
  token: string;
  /** Authenticated user data */
  user: AppUser;
}

/**
 * Auth store state interface
 */
export interface AuthState {
  /** Whether the auth state has been initialized from storage */
  isReady: boolean;
  /** Current authentication data, or null if not authenticated */
  auth: AuthData | null;
  /** Update authentication state and persist to secure storage */
  setAuth: (auth: AuthData | null) => void;
}

/**
 * Auth modal mode type
 */
export type AuthMode = "signin" | "signup";

/**
 * Options for opening the auth modal
 */
export interface OpenAuthModalOptions {
  mode?: AuthMode;
}

/**
 * Auth modal state interface
 */
export interface AuthModalState {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Current authentication mode */
  mode: AuthMode;
  /** Open the auth modal with optional mode */
  open: (options?: OpenAuthModalOptions) => void;
  /** Close the auth modal */
  close: () => void;
}

/**
 * Authentication state store
 * 
 * @description Manages the authentication state of the application,
 * including JWT token and user data. Persists authentication to
 * Expo SecureStore for secure local storage.
 * 
 * @example
 * ```tsx
 * const { auth, setAuth, isReady } = useAuthStore();
 * 
 * if (!isReady) return <LoadingScreen />;
 * if (!auth) return <LoginScreen />;
 * return <AuthenticatedApp />;
 * ```
 */
export const useAuthStore = create<AuthState>((set) => ({
  isReady: false,
  auth: null,
  setAuth: (auth: AuthData | null): void => {
    if (auth) {
      SecureStore.setItemAsync(authKey, JSON.stringify(auth));
    } else {
      SecureStore.deleteItemAsync(authKey);
    }
    set({ auth });
  },
}));

/**
 * Authentication modal state store
 * 
 * @description Controls the visibility and mode of the authentication modal.
 * Use this store to programmatically show/hide the auth modal.
 * 
 * @example
 * ```tsx
 * const { open, close, isOpen, mode } = useAuthModal();
 * 
 * // Open signup modal
 * open({ mode: 'signup' });
 * 
 * // Open signin modal
 * open({ mode: 'signin' });
 * 
 * // Close modal
 * close();
 * ```
 */
export const useAuthModal = create<AuthModalState>((set) => ({
  isOpen: false,
  mode: "signup",
  open: (options?: OpenAuthModalOptions): void =>
    set({ isOpen: true, mode: options?.mode || "signup" }),
  close: (): void => set({ isOpen: false }),
}));
