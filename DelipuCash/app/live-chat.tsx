/**
 * Live Chat Screen
 * Tawk.to widget embedded in a lazy-loaded WebView with automatic user context
 * pre-fill and WhatsApp fallback for Ugandan users.
 *
 * Architecture:
 * - True lazy loading: WebView only mounts when user opens this screen
 * - source={{ html }} injects Tawk_API.visitor BEFORE widget loads
 * - State machine: loading → ready / error (with retry via webViewKey remount)
 * - Skeleton loading + 15s timeout + WhatsApp fallback bar
 * - Clean unmount: WebView destroyed when screen is popped from stack
 */

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Linking,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import {
  ArrowLeft,
  MessageCircle,
  AlertCircle as AlertCircleIcon,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useToast } from '@/components/ui/Toast';
import useUser from '@/utils/useUser';
import {
  SPACING,
  RADIUS,
  ICON_SIZE,
  useTheme,
  withAlpha,
  type ThemeColors,
} from '@/utils/theme';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TAWK_PROPERTY_ID = process.env.EXPO_PUBLIC_TAWK_PROPERTY_ID ?? '';
const TAWK_WIDGET_ID = process.env.EXPO_PUBLIC_TAWK_WIDGET_ID ?? 'default';

const WHATSAPP_NUMBER = '256773336896';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Hello, I need help with my DelipuCash account',
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

// ---------------------------------------------------------------------------
// Tawk.to HTML Builder
// ---------------------------------------------------------------------------

function buildTawkHTML(params: {
  propertyId: string;
  widgetId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userId: string;
  backgroundColor: string;
  textColor: string;
}): string {
  // JSON.stringify safely escapes any special chars in user data
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:${params.backgroundColor};color:${params.textColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden}
    #loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px}
    .spinner{width:32px;height:32px;border:3px solid rgba(128,128,128,0.3);border-top-color:#4D4DFF;border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    #loading p{font-size:14px;opacity:0.6}
  </style>
</head>
<body>
  <div id="loading"><div class="spinner"></div><p>Connecting to support...</p></div>
  <script>
    var Tawk_API=Tawk_API||{};
    Tawk_API.visitor={name:${JSON.stringify(params.userName)},email:${JSON.stringify(params.userEmail)},hash:''};
    Tawk_API.onLoad=function(){
      var el=document.getElementById('loading');if(el)el.style.display='none';
      Tawk_API.setAttributes({userId:${JSON.stringify(params.userId)},phone:${JSON.stringify(params.userPhone)},platform:'${Platform.OS}',app:'DelipuCash'},function(){});
      Tawk_API.maximize();
      if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'TAWK_LOADED'}));
    };
    Tawk_API.onChatStarted=function(){
      if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'CHAT_STARTED'}));
    };
    var Tawk_LoadStart=new Date();
    (function(){
      var s1=document.createElement('script'),s0=document.getElementsByTagName('script')[0];
      s1.async=true;s1.src='https://embed.tawk.to/${params.propertyId}/${params.widgetId}';
      s1.charset='UTF-8';s1.setAttribute('crossorigin','*');
      s1.onerror=function(){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'TAWK_ERROR',message:'Failed to load chat widget'}))};
      s0.parentNode.insertBefore(s1,s0);
    })();
    setTimeout(function(){
      var el=document.getElementById('loading');
      if(el&&el.style.display!=='none'&&window.ReactNativeWebView)
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'TAWK_TIMEOUT'}));
    },15000);
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Skeleton Components (matches help-support.tsx pattern)
// ---------------------------------------------------------------------------

const SkeletonPulse = memo<{ colors: ThemeColors; style?: object }>(
  ({ colors, style }) => {
    const opacity = useSharedValue(0.3);

    React.useEffect(() => {
      opacity.value = withRepeat(
        withTiming(1, { duration: 800 }),
        -1,
        true,
      );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      backgroundColor: colors.border,
    }));

    return <Animated.View style={[animatedStyle, style]} />;
  },
);
SkeletonPulse.displayName = 'SkeletonPulse';

const ChatSkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View
    style={styles.skeletonContent}
    accessibilityLabel="Loading live chat"
    accessibilityRole="progressbar"
  >
    {/* Agent header bar */}
    <View style={styles.skeletonHeader}>
      <SkeletonPulse
        colors={colors}
        style={{ width: 48, height: 48, borderRadius: RADIUS.full }}
      />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <SkeletonPulse
          colors={colors}
          style={{ width: '50%', height: 14, borderRadius: 6 }}
        />
        <SkeletonPulse
          colors={colors}
          style={{ width: '30%', height: 10, borderRadius: 4, marginTop: 6 }}
        />
      </View>
    </View>

    {/* Simulated chat bubbles */}
    <SkeletonPulse
      colors={colors}
      style={[styles.skeletonBubble, { width: '70%', alignSelf: 'flex-start' }]}
    />
    <SkeletonPulse
      colors={colors}
      style={[styles.skeletonBubble, { width: '50%', alignSelf: 'flex-end' }]}
    />
    <SkeletonPulse
      colors={colors}
      style={[styles.skeletonBubble, { width: '80%', alignSelf: 'flex-start' }]}
    />
    <SkeletonPulse
      colors={colors}
      style={[styles.skeletonBubble, { width: '40%', alignSelf: 'flex-end' }]}
    />
  </View>
));
ChatSkeleton.displayName = 'ChatSkeleton';

// ---------------------------------------------------------------------------
// Error State (matches help-support.tsx SupportErrorState pattern)
// ---------------------------------------------------------------------------

const ChatErrorState = memo<{
  message: string;
  onRetry: () => void;
  colors: ThemeColors;
}>(({ message, onRetry, colors }) => (
  <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
    <View
      style={[
        styles.errorIconContainer,
        { backgroundColor: withAlpha(colors.error, 0.1) },
      ]}
    >
      <AlertCircleIcon size={ICON_SIZE.xl} color={colors.error} />
    </View>
    <ThemedText style={[styles.errorTitle, { color: colors.text }]}>
      Unable to connect
    </ThemedText>
    <ThemedText
      style={[styles.errorMessage, { color: colors.textSecondary }]}
    >
      {message}
    </ThemedText>
    <PrimaryButton
      title="Try Again"
      onPress={onRetry}
      leftIcon={<RefreshCw size={ICON_SIZE.sm} color="#FFFFFF" />}
      size="small"
    />
  </Animated.View>
));
ChatErrorState.displayName = 'ChatErrorState';

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function LiveChatScreen() {
  const { colors, statusBarStyle } = useTheme();
  const { showToast } = useToast();
  const { data: user } = useUser();

  // Chat state machine: 'loading' | 'ready' | 'error'
  const [chatState, setChatState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [webViewKey, setWebViewKey] = useState(0);
  const webViewRef = useRef<WebView>(null);

  // Build user context for Tawk.to pre-fill
  const userName = useMemo(() => {
    if (user?.firstName && user?.lastName)
      return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    return 'DelipuCash User';
  }, [user?.firstName, user?.lastName]);

  const userEmail = user?.email ?? '';
  const userPhone = user?.phone ?? '';
  const userId = user?.id ?? '';

  // Generate HTML with user context and theme colors
  const htmlContent = useMemo(() => {
    if (!TAWK_PROPERTY_ID) return null;
    return buildTawkHTML({
      propertyId: TAWK_PROPERTY_ID,
      widgetId: TAWK_WIDGET_ID,
      userName,
      userEmail,
      userPhone,
      userId,
      backgroundColor: colors.background,
      textColor: colors.text,
    });
  }, [userName, userEmail, userPhone, userId, colors.background, colors.text]);

  // Handle messages from Tawk.to WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'TAWK_LOADED':
          setChatState('ready');
          AccessibilityInfo.announceForAccessibility(
            'Live chat connected. You can now type your message.',
          );
          break;
        case 'TAWK_ERROR':
        case 'TAWK_TIMEOUT':
          setChatState('error');
          setErrorMessage(
            data.message ?? 'Chat service is temporarily unavailable',
          );
          break;
        case 'CHAT_STARTED':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
      }
    } catch {
      // Ignore non-JSON messages from WebView
    }
  }, []);

  const handleWebViewError = useCallback(() => {
    setChatState('error');
    setErrorMessage(
      'Failed to load chat. Please check your internet connection.',
    );
  }, []);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChatState('loading');
    setErrorMessage('');
    setWebViewKey((k) => k + 1);
  }, []);

  const handleWhatsApp = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const canOpen = await Linking.canOpenURL(WHATSAPP_URL);
      if (canOpen) {
        await Linking.openURL(WHATSAPP_URL);
      } else {
        showToast({
          message: 'WhatsApp is not installed on this device',
          type: 'error',
        });
      }
    } catch {
      showToast({ message: 'Failed to open WhatsApp', type: 'error' });
    }
  }, [showToast]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  // Allow only Tawk.to domains; open everything else in system browser
  const handleNavigationRequest = useCallback(
    (request: { url: string }) => {
      if (
        request.url.startsWith('about:') ||
        request.url.includes('tawk.to') ||
        request.url.includes('va.tawk.to')
      ) {
        return true;
      }
      Linking.openURL(request.url).catch(() => {});
      return false;
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Missing config guard
  // -------------------------------------------------------------------------

  if (!TAWK_PROPERTY_ID) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <StatusBar style={statusBarStyle} />

        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable
            style={[styles.backButton, { backgroundColor: colors.background }]}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={ICON_SIZE.sm} color={colors.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
              Live Chat
            </ThemedText>
          </View>
        </View>

        <ChatErrorState
          message="Chat service is not configured. Please contact us via WhatsApp instead."
          onRetry={handleWhatsApp}
          colors={colors}
        />

        <View
          style={[
            styles.whatsappBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
            },
          ]}
        >
          <ThemedText
            style={[styles.whatsappLabel, { color: colors.textSecondary }]}
          >
            Prefer WhatsApp?
          </ThemedText>
          <Pressable
            style={styles.whatsappButton}
            onPress={handleWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Chat on WhatsApp"
          >
            <MessageCircle size={ICON_SIZE.sm} color="#FFFFFF" />
            <ThemedText style={styles.whatsappButtonText}>WhatsApp</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style={statusBarStyle} />

      {/* Header — matches help-support.tsx pattern */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={[styles.backButton, { backgroundColor: colors.background }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ICON_SIZE.sm} color={colors.text} />
        </Pressable>

        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            Live Chat
          </ThemedText>
          <ThemedText
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            {chatState === 'ready'
              ? 'Connected'
              : chatState === 'loading'
                ? 'Connecting...'
                : 'Offline'}
          </ThemedText>
        </View>

        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                chatState === 'ready'
                  ? colors.success
                  : chatState === 'loading'
                    ? colors.warning
                    : colors.error,
            },
          ]}
          accessibilityLabel={`Chat status: ${chatState}`}
        />
      </View>

      {/* Chat content */}
      <View style={styles.chatContainer}>
        {/* Skeleton overlay while loading */}
        {chatState === 'loading' && <ChatSkeleton colors={colors} />}

        {/* Error state */}
        {chatState === 'error' && (
          <ChatErrorState
            message={errorMessage}
            onRetry={handleRetry}
            colors={colors}
          />
        )}

        {/* WebView — renders while loading (hidden) so Tawk initializes,
            then becomes visible when TAWK_LOADED fires */}
        {htmlContent && chatState !== 'error' && (
          <WebView
            key={webViewKey}
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={[
              styles.webView,
              chatState === 'loading' && styles.webViewHidden,
            ]}
            onMessage={handleMessage}
            onError={handleWebViewError}
            onHttpError={handleWebViewError}
            onShouldStartLoadWithRequest={handleNavigationRequest}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState={false}
            scalesPageToFit={false}
            allowsInlineMediaPlayback
            mixedContentMode="compatibility"
            overScrollMode="never"
            accessibilityLabel="Live chat with support agent"
          />
        )}
      </View>

      {/* WhatsApp Fallback Bar — always visible at bottom */}
      <View
        style={[
          styles.whatsappBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        <ThemedText
          style={[styles.whatsappLabel, { color: colors.textSecondary }]}
        >
          Prefer WhatsApp?
        </ThemedText>
        <Pressable
          style={styles.whatsappButton}
          onPress={handleWhatsApp}
          accessibilityRole="button"
          accessibilityLabel="Chat on WhatsApp"
        >
          <MessageCircle size={ICON_SIZE.sm} color="#FFFFFF" />
          <ThemedText style={styles.whatsappButtonText}>WhatsApp</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header — matches help-support.tsx header pattern
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    marginLeft: SPACING.sm,
  },

  // Chat container
  chatContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  webViewHidden: {
    opacity: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Skeleton
  skeletonContent: {
    flex: 1,
    padding: SPACING.md,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  skeletonBubble: {
    height: 40,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },

  // Error state — matches help-support.tsx errorContainer
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: SPACING.lg,
  },

  // WhatsApp fallback bar
  whatsappBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  whatsappLabel: {
    flex: 1,
    fontSize: 13,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
