import Constants from "expo-constants";
import * as Device from "expo-device";
import type * as NotificationsType from "expo-notifications";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Platform } from "react-native";

const isExpoGo =
  Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";
const isAndroidExpoGo = Platform.OS === "android" && isExpoGo;

let notificationsModule: typeof NotificationsType | null = null;
let notificationHandlerSet = false;

async function getNotifications(): Promise<typeof NotificationsType | null> {
  if (isAndroidExpoGo) {
    return null;
  }

  if (notificationsModule) {
    return notificationsModule;
  }

  const mod = await import("expo-notifications");

  if (!notificationHandlerSet) {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerSet = true;
  }

  notificationsModule = mod;
  return mod;
}

interface PushMessage {
  to?: string;
  sound?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface NotificationContextValue {
  expoPushToken?: string;
  hasPermission: boolean;
  lastNotification?: NotificationsType.Notification;
  lastResponse?: NotificationsType.NotificationResponse;
  hasNewNotification: boolean;
  requestPermissions: () => Promise<boolean>;
  markNotificationsSeen: () => void;
  scheduleLocalNotification: (
    content: NotificationsType.NotificationContentInput,
    trigger?: NotificationsType.NotificationTriggerInput,
  ) => Promise<string | undefined>;
  sendPushNotification: (message: PushMessage) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  const notifications = await getNotifications();
  if (!notifications) {
    return;
  }

  await notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });
}

async function getProjectId(): Promise<string | undefined> {
  const expoConfigProjectId = Constants?.expoConfig?.extra?.eas?.projectId as
    | string
    | undefined;
  if (expoConfigProjectId) {
    return expoConfigProjectId;
  }

  const easConfigProjectId = Constants?.easConfig?.projectId as string | undefined;
  if (easConfigProjectId) {
    return easConfigProjectId;
  }

  return undefined;
}

async function registerForPushNotifications(): Promise<{
  granted: boolean;
  token?: string;
}> {
  if (isAndroidExpoGo) {
    console.warn(
      "Android push notifications are unavailable in Expo Go. Use a development build to test push notifications.",
    );
    return { granted: false };
  }

  await ensureAndroidChannel();

  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return { granted: false };
  }

  const notifications = await getNotifications();
  if (!notifications) {
    return { granted: false };
  }

  const { status: existingStatus } = await notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  const granted = finalStatus === "granted";

  if (!granted) {
    return { granted: false };
  }

  const projectId = await getProjectId();

  if (!projectId) {
    console.warn("Expo project ID is not configured; cannot fetch push token.");
    return { granted: true };
  }

  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  return { granted: true, token };
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps): React.ReactElement {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [lastNotification, setLastNotification] =
    useState<NotificationsType.Notification | undefined>();
  const [lastResponse, setLastResponse] =
    useState<NotificationsType.NotificationResponse | undefined>();
  const [hasNewNotification, setHasNewNotification] = useState<boolean>(false);

  const notificationListener = useRef<NotificationsType.Subscription | null>(null);
  const responseListener = useRef<NotificationsType.Subscription | null>(null);

  const requestPermissions = useCallback(async () => {
    if (isAndroidExpoGo) {
      console.warn(
        "Skipping push registration: Android Expo Go builds do not support remote notifications.",
      );
      setHasPermission(false);
      return false;
    }

    try {
      const { granted, token } = await registerForPushNotifications();
      setHasPermission(granted);

      if (granted && token) {
        setExpoPushToken(token);
      }

      return granted;
    } catch (error) {
      console.error("Failed to register for push notifications", error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const markNotificationsSeen = useCallback(() => {
    setHasNewNotification(false);
  }, []);

  const scheduleLocalNotification = useCallback<
    NotificationContextValue["scheduleLocalNotification"]
  >(async (content, trigger) => {
    const notifications = await getNotifications();
    if (!notifications) {
      return undefined;
    }

    try {
      const id = await notifications.scheduleNotificationAsync({
        content,
        trigger: trigger ?? null,
      });
      return id;
    } catch (error) {
      console.error("Failed to schedule local notification", error);
      return undefined;
    }
  }, []);

  const sendPushNotification = useCallback<
    NotificationContextValue["sendPushNotification"]
  >(async (message) => {
    const token = message.to ?? expoPushToken;

    if (isAndroidExpoGo) {
      console.warn(
        "Skipping push send: Android Expo Go builds do not support remote notifications.",
      );
      return;
    }

    if (!token) {
      console.warn("Expo push token not available; cannot send push notification.");
      return;
    }

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          sound: message.sound ?? "default",
          title: message.title ?? "",
          body: message.body ?? "",
          data: message.data ?? {},
        }),
      });
    } catch (error) {
      console.error("Failed to send Expo push notification", error);
    }
  }, [expoPushToken]);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  useEffect(() => {
    if (isAndroidExpoGo) {
      return undefined;
    }

    let isMounted = true;

    getNotifications().then((notifications) => {
      if (!notifications || !isMounted) {
        return;
      }

      notificationListener.current = notifications.addNotificationReceivedListener(
        (notification) => {
          setLastNotification(notification);
          setHasNewNotification(true);
        },
      );

      responseListener.current = notifications.addNotificationResponseReceivedListener(
        (response) => {
          setLastResponse(response);
          setHasNewNotification(true);
        },
      );
    });

    return () => {
      isMounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    expoPushToken,
    hasPermission,
    lastNotification,
    lastResponse,
    hasNewNotification,
    requestPermissions,
    markNotificationsSeen,
    scheduleLocalNotification,
    sendPushNotification,
  }), [
    expoPushToken,
    hasPermission,
    lastNotification,
    lastResponse,
    hasNewNotification,
    requestPermissions,
    markNotificationsSeen,
    scheduleLocalNotification,
    sendPushNotification,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

function usePushNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("usePushNotifications must be used within a NotificationProvider");
  }

  return context;
}

// Explicit re-export to ensure availability in all bundlers
export { usePushNotifications };
export default NotificationProvider;
