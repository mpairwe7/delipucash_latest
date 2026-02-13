import React, { useMemo } from "react";
import { Modal, View, StyleSheet } from "react-native";
import { AuthWebView } from "./AuthWebView";
import { useAuthStore, useAuthModal, AuthMode } from "./store";

/**
 * Props for the AuthModal component
 */
export interface AuthModalProps {
  /** Optional custom test ID for testing */
  testID?: string;
}

/**
 * Authentication Modal Component
 * 
 * @description Renders a full-screen modal for authentication purposes.
 * The modal displays a WebView that handles sign in/sign up flows.
 * 
 * To show the modal programmatically, use either:
 * - `useAuthModal` hook for direct control
 * - `useRequireAuth` hook for automatic display on protected routes
 * 
 * @example
 * ```tsx
 * // Using useAuthModal for direct control
 * import { useAuthModal } from '@/utils/auth';
 * 
 * function MyComponent() {
 *   const { open } = useAuthModal();
 *   return <Button title="Login" onPress={() => open({ mode: 'signin' })} />;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Using useRequireAuth for automatic protection
 * import { useRequireAuth } from '@/utils/auth';
 * 
 * function ProtectedComponent() {
 *   useRequireAuth();
 *   return <Text>Protected Content</Text>;
 * }
 * ```
 */
export const AuthModal: React.FC<AuthModalProps> = ({ testID }) => {
  const isOpen = useAuthModal(s => s.isOpen);
  const mode = useAuthModal(s => s.mode);
  const auth = useAuthStore(s => s.auth);

  const proxyURL = process.env.EXPO_PUBLIC_PROXY_BASE_URL;
  const baseURL = process.env.EXPO_PUBLIC_BASE_URL;

  // Don't render if missing required URLs
  if (!proxyURL && !baseURL) {
    return null;
  }

  return (
    <Modal
      visible={isOpen && !auth}
      transparent={true}
      animationType="slide"
      testID={testID}
    >
      <View style={styles.container}>
        <AuthWebView
          mode={mode}
          proxyURL={proxyURL}
          baseURL={baseURL}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
    width: "100%",
    backgroundColor: "#fff",
    padding: 0,
  },
});

export { useAuthModal } from "./store";
export default AuthModal;
