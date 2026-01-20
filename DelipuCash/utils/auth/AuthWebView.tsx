import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useAuthStore, AuthMode, AuthData } from "./store";

const callbackUrl = "/api/auth/token";
const callbackQueryString = `callbackUrl=${callbackUrl}`;

/**
 * Props for the AuthWebView component
 */
export interface AuthWebViewProps {
  /** Authentication mode (signin or signup) */
  mode: AuthMode;
  /** Proxy URL for web platform */
  proxyURL?: string;
  /** Base URL for authentication endpoints */
  baseURL?: string;
}

/**
 * Message event data from auth iframe
 */
interface AuthMessageData {
  type: "AUTH_SUCCESS" | "AUTH_ERROR";
  jwt?: string;
  user?: AuthData["user"];
  error?: string;
}

/**
 * Token response from callback URL
 */
interface TokenResponse {
  jwt: string;
  user: AuthData["user"];
}

/**
 * Authentication WebView Component
 * 
 * @description Renders a WebView for authentication that handles both web (iframe)
 * and native (WebView) platforms. Manages authentication callbacks and token storage.
 * 
 * @param props - Component props
 */
export const AuthWebView: React.FC<AuthWebViewProps> = ({
  mode,
  proxyURL,
  baseURL,
}) => {
  const [currentURI, setURI] = useState<string>(
    `${baseURL}/account/${mode}?${callbackQueryString}`
  );
  const { auth, setAuth, isReady } = useAuthStore();
  const isAuthenticated = isReady ? !!auth : null;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Navigate back when authenticated (native only)
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    if (isAuthenticated) {
      router.back();
    }
  }, [isAuthenticated]);

  // Update URI when mode changes
  useEffect(() => {
    if (isAuthenticated) {
      return;
    }
    setURI(`${baseURL}/account/${mode}?${callbackQueryString}`);
  }, [mode, baseURL, isAuthenticated]);

  // Web platform: listen for postMessage from iframe
  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) {
      return;
    }

    const handleMessage = (event: MessageEvent<AuthMessageData>): void => {
      // Verify the origin for security
      if (event.origin !== process.env.EXPO_PUBLIC_PROXY_BASE_URL) {
        return;
      }

      if (event.data.type === "AUTH_SUCCESS" && event.data.jwt && event.data.user) {
        setAuth({
          token: event.data.jwt,
          user: event.data.user,
        });
      } else if (event.data.type === "AUTH_ERROR") {
        console.error("Auth error:", event.data.error);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [setAuth]);

  // Web platform: render iframe
  if (Platform.OS === "web") {
    const handleIframeError = (): void => {
      console.error("Failed to load auth iframe");
    };

    return (
      <iframe
        ref={iframeRef}
        title="Authentication"
        src={`${proxyURL}/account/${mode}?callbackUrl=/api/auth/expo-web-success`}
        style={{ width: "100%", height: "100%", border: "none" }}
        onError={handleIframeError}
      />
    );
  }

  // Native platform: render WebView
  const handleShouldStartLoadWithRequest = (
    request: WebViewNavigation
  ): boolean => {
    // Handle token callback
    if (request.url === `${baseURL}${callbackUrl}`) {
      fetch(request.url)
        .then(async (response) => {
          const data: TokenResponse = await response.json();
          setAuth({ token: data.jwt, user: data.user });
        })
        .catch((error) => {
          console.error("Failed to fetch auth token:", error);
        });
      return false;
    }

    if (request.url === currentURI) return true;

    // Add query string properly by checking if URL already has parameters
    const hasParams = request.url.includes("?");
    const separator = hasParams ? "&" : "?";
    const newURL = request.url.replaceAll(proxyURL ?? "", baseURL ?? "");

    if (newURL.endsWith(callbackUrl)) {
      setURI(newURL);
      return false;
    }

    setURI(`${newURL}${separator}${callbackQueryString}`);
    return false;
  };

  return (
    <WebView
      sharedCookiesEnabled
      source={{ uri: currentURI }}
      headers={{
        "x-createxyz-project-group-id": process.env.EXPO_PUBLIC_PROJECT_GROUP_ID ?? "",
        host: process.env.EXPO_PUBLIC_HOST ?? "",
        "x-forwarded-host": process.env.EXPO_PUBLIC_HOST ?? "",
        "x-createxyz-host": process.env.EXPO_PUBLIC_HOST ?? "",
      }}
      onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      style={styles.webview}
    />
  );
};

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
});

export default AuthWebView;
