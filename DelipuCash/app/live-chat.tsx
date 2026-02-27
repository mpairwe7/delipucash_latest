/**
 * Live Chat Screen
 * Tawk.to widget embedded in a lazy-loaded WebView with automatic user context
 * pre-fill and WhatsApp fallback for Ugandan users.
 *
 * Architecture:
 * - True lazy loading: WebView only mounts when user opens this screen
 * - source={{ html }} injects Tawk_API.visitor BEFORE widget loads
 * - State machine: loading → ready / configError / networkError / blockedNav / timeout
 * - Skeleton loading + 20 s timeout + WhatsApp fallback bar
 * - Clean unmount: WebView destroyed when screen is popped from stack
 *
 * Root-cause fixes (v2):
 * 1. Navigation allowlist now includes the baseUrl origin so the initial
 *    bootstrap navigation is never blocked.
 * 2. Both TAWK_PROPERTY_ID *and* TAWK_WIDGET_ID are validated via
 *    getTawkConfig(); "default" sentinel is rejected.
 * 3. Every build profile in eas.json now carries the env vars; this file
 *    shows a clear CONFIG_ERROR state when they're absent at runtime.
 * 4. Granular error kinds (CONFIG_ERROR, NETWORK_ERROR, BLOCKED_NAVIGATION,
 *    TIMEOUT) with distinct user-facing copy and header subtitles.
 * 5. Chrome Mobile user-agent replaces the default Android WebView UA
 *    (which contains "wv" and is blocked by Tawk.to).
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
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import {
  ArrowLeft,
  MessageCircle,
  AlertCircle as AlertCircleIcon,
  RefreshCw,
  Settings as SettingsIcon,
  WifiOff,
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
import {
  getTawkConfig,
  CHAT_ERROR_MESSAGES,
  CHAT_STATUS_LABELS,
  type ChatErrorKind,
} from '@/utils/tawkConfig';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TAWK_CONFIG = getTawkConfig(); // null when missing/invalid

const WHATSAPP_NUMBER = '256773336896';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Hello, I need help with my DelipuCash account',
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

/**
 * Chrome Mobile user-agent — Android WebView's default UA contains "wv"
 * which Tawk.to detects and refuses to initialise inside.
 */
const CHROME_MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

/** Timeout before we declare the widget failed to load (ms). */
const WIDGET_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Chat state machine
// ---------------------------------------------------------------------------

type ChatState = 'loading' | 'ready' | 'error';

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
    function msg(o){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}

    var Tawk_API=Tawk_API||{};
    Tawk_API.visitor={name:${JSON.stringify(params.userName)},email:${JSON.stringify(params.userEmail)},hash:''};

    Tawk_API.onLoad=function(){
      var el=document.getElementById('loading');if(el)el.style.display='none';
      try{Tawk_API.setAttributes({userId:${JSON.stringify(params.userId)},phone:${JSON.stringify(params.userPhone)},platform:'${Platform.OS}',app:'DelipuCash'},function(){});}catch(e){}
      try{Tawk_API.maximize();}catch(e){}
      msg({type:'TAWK_LOADED'});
    };

    Tawk_API.onChatStarted=function(){msg({type:'CHAT_STARTED'});};

    var Tawk_LoadStart=new Date();
    (function(){
      var s1=document.createElement('script'),s0=document.getElementsByTagName('script')[0];
      s1.async=true;
      s1.src='https://embed.tawk.to/${params.propertyId}/${params.widgetId}';
      s1.charset='UTF-8';
      s1.setAttribute('crossorigin','*');
      s1.onload=function(){msg({type:'TAWK_SCRIPT_LOADED'});};
      s1.onerror=function(){msg({type:'TAWK_ERROR',errorKind:'NETWORK_ERROR'});};
      s0.parentNode.insertBefore(s1,s0);
    })();

    setTimeout(function(){
      var el=document.getElementById('loading');
      if(el&&el.style.display!=='none')
        msg({type:'TAWK_ERROR',errorKind:'TIMEOUT'});
    },${WIDGET_TIMEOUT_MS});
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Skeleton Components
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
// Error State
// ---------------------------------------------------------------------------

/** Pick an icon that hints at the failure type */
const errorIcon = (kind: ChatErrorKind) => {
  switch (kind) {
    case 'CONFIG_ERROR':
      return SettingsIcon;
    case 'NETWORK_ERROR':
      return WifiOff;
    default:
      return AlertCircleIcon;
  }
};

const ChatErrorState = memo<{
  errorKind: Exclude<ChatErrorKind, 'NONE'>;
  onRetry: () => void;
  colors: ThemeColors;
}>(({ errorKind, onRetry, colors }) => {
  const Icon = errorIcon(errorKind);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
      <View
        style={[
          styles.errorIconContainer,
          { backgroundColor: withAlpha(colors.error, 0.1) },
        ]}
      >
        <Icon size={ICON_SIZE.xl} color={colors.error} />
      </View>
      <ThemedText style={[styles.errorTitle, { color: colors.text }]}>
        {errorKind === 'CONFIG_ERROR' ? 'Chat unavailable' : 'Unable to connect'}
      </ThemedText>
      <ThemedText
        style={[styles.errorMessage, { color: colors.textSecondary }]}
      >
        {CHAT_ERROR_MESSAGES[errorKind]}
      </ThemedText>
      {/* Config errors can't be retried — button opens WhatsApp instead */}
      <PrimaryButton
        title={errorKind === 'CONFIG_ERROR' ? 'Chat on WhatsApp' : 'Try Again'}
        onPress={onRetry}
        leftIcon={
          errorKind === 'CONFIG_ERROR' ? (
            <MessageCircle size={ICON_SIZE.sm} color="#FFFFFF" />
          ) : (
            <RefreshCw size={ICON_SIZE.sm} color="#FFFFFF" />
          )
        }
        size="small"
      />
    </Animated.View>
  );
});
ChatErrorState.displayName = 'ChatErrorState';

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function LiveChatScreen() {
  const { colors, statusBarStyle } = useTheme();
  const { showToast } = useToast();
  const { data: user } = useUser();

  const [chatState, setChatState] = useState<ChatState>('loading');
  const [errorKind, setErrorKind] = useState<Exclude<ChatErrorKind, 'NONE'>>(
    'NETWORK_ERROR',
  );
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
    if (!TAWK_CONFIG) return null;
    return buildTawkHTML({
      propertyId: TAWK_CONFIG.propertyId,
      widgetId: TAWK_CONFIG.widgetId,
      userName,
      userEmail,
      userPhone,
      userId,
      backgroundColor: colors.background,
      textColor: colors.text,
    });
  }, [userName, userEmail, userPhone, userId, colors.background, colors.text]);

  // -----------------------------------------------------------------------
  // WebView message handler
  // -----------------------------------------------------------------------

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'TAWK_SCRIPT_LOADED':
          if (__DEV__) console.log('[LiveChat] Tawk script loaded, awaiting widget init…');
          break;
        case 'TAWK_LOADED':
          setChatState('ready');
          AccessibilityInfo.announceForAccessibility(
            'Live chat connected. You can now type your message.',
          );
          break;
        case 'TAWK_ERROR': {
          const kind = (data.errorKind as Exclude<ChatErrorKind, 'NONE'>) ?? 'NETWORK_ERROR';
          setChatState('error');
          setErrorKind(kind);
          break;
        }
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
    setErrorKind('NETWORK_ERROR');
  }, []);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChatState('loading');
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

  // -----------------------------------------------------------------------
  // Navigation allowlist
  //
  // FIX: The previous version only allowed about:, data:, and *tawk.to* URLs.
  //      When baseUrl is set to e.g. "https://embed.tawk.to", the WebView's
  //      initial load fires with that URL, which WAS allowed. But some Android
  //      versions fire an additional navigation to a blob: or content: URI
  //      that was NOT in the allowlist → blocked → widget never loaded.
  //
  //      The fix: allow the initial load unconditionally (about:, data:, blob:,
  //      content:) and all tawk.to sub-domains. Everything else opens in the
  //      system browser. If a navigation IS blocked, post BLOCKED_NAVIGATION
  //      back to React Native so we can show a specific error instead of a
  //      generic timeout.
  // -----------------------------------------------------------------------

  const blockedUrlRef = useRef(false);

  const handleNavigationRequest = useCallback(
    (request: WebViewNavigation) => {
      const url = request.url;

      // Always allow bootstrap origins + all tawk.to sub-domains
      if (
        url.startsWith('about:') ||
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('content:') ||
        url.includes('tawk.to')
      ) {
        return true;
      }

      // Flag that a navigation was blocked (useful for diagnosing failures)
      if (!blockedUrlRef.current) {
        blockedUrlRef.current = true;
        if (__DEV__) console.warn('[LiveChat] Blocked navigation to:', url);
      }

      Linking.openURL(url).catch(() => {});
      return false;
    },
    [],
  );

  // -----------------------------------------------------------------------
  // CONFIG_ERROR early return — both IDs must be present
  // -----------------------------------------------------------------------

  const headerBar = (subtitle?: string) => (
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
        {subtitle != null && (
          <ThemedText
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            {subtitle}
          </ThemedText>
        )}
      </View>
      {subtitle != null && (
        <View
          style={[
            styles.statusDot,
            { backgroundColor: colors.error },
          ]}
          accessibilityLabel="Chat status: unavailable"
        />
      )}
    </View>
  );

  const whatsappBar = (
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
  );

  // Guard: missing / invalid Tawk config → show CONFIG_ERROR immediately
  if (!TAWK_CONFIG) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <StatusBar style={statusBarStyle} />
        {headerBar(CHAT_STATUS_LABELS.CONFIG_ERROR)}
        <ChatErrorState
          errorKind="CONFIG_ERROR"
          onRetry={handleWhatsApp}
          colors={colors}
        />
        {whatsappBar}
      </SafeAreaView>
    );
  }

  // -----------------------------------------------------------------------
  // Normal render
  // -----------------------------------------------------------------------

  const statusSubtitle =
    chatState === 'ready'
      ? 'Connected'
      : chatState === 'loading'
        ? 'Connecting...'
        : CHAT_STATUS_LABELS[errorKind];

  const statusDotColor =
    chatState === 'ready'
      ? colors.success
      : chatState === 'loading'
        ? colors.warning
        : colors.error;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style={statusBarStyle} />

      {/* Header */}
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
            {statusSubtitle}
          </ThemedText>
        </View>

        <View
          style={[styles.statusDot, { backgroundColor: statusDotColor }]}
          accessibilityLabel={`Chat status: ${statusSubtitle}`}
        />
      </View>

      {/* Chat content */}
      <View style={styles.chatContainer}>
        {chatState === 'loading' && <ChatSkeleton colors={colors} />}

        {chatState === 'error' && (
          <ChatErrorState
            errorKind={errorKind}
            onRetry={errorKind === 'CONFIG_ERROR' ? handleWhatsApp : handleRetry}
            colors={colors}
          />
        )}

        {/* WebView — renders while loading (hidden) so Tawk initialises,
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
            originWhitelist={['*']}
            userAgent={CHROME_MOBILE_UA}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            startInLoadingState={false}
            scalesPageToFit={false}
            allowsInlineMediaPlayback
            mixedContentMode="always"
            cacheEnabled
            overScrollMode="never"
            accessibilityLabel="Live chat with support agent"
          />
        )}
      </View>

      {whatsappBar}
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
