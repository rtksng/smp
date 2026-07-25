import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  focusManager,
  onlineManager,
  useQueryClient
} from "@tanstack/react-query";
import { registerDevice } from "../api/delivery";
import { useAuth } from "../auth/auth-context";
import {
  getExpoPushRegistration
} from "./native";
import { getAssignmentIdFromNotificationData } from "./notification";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export function NativeAppLifecycle() {
  const { accessToken, refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const handledNotificationId = useRef<string | null>(null);
  const registeredToken = useRef<string | null>(null);

  const registerPushDevice = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    const registration = await getExpoPushRegistration();

    if (!registration || registeredToken.current === registration.pushToken) {
      return;
    }

    await registerDevice(accessToken, {
      notificationsEnabled: true,
      platform: registration.platform,
      pushToken: registration.pushToken
    });
    registeredToken.current = registration.pushToken;
  }, [accessToken]);

  const openNotification = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!accessToken || !response) {
        return;
      }

      const responseId = response.notification.request.identifier;

      if (handledNotificationId.current === responseId) {
        return;
      }

      const assignmentId = getAssignmentIdFromNotificationData(
        response.notification.request.content.data
      );

      if (!assignmentId) {
        return;
      }

      handledNotificationId.current = responseId;
      router.push({
        params: { id: assignmentId },
        pathname: "/(app)/assignments/[id]"
      });
    },
    [accessToken]
  );

  useEffect(() => {
    return onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) =>
        setOnline(Boolean(state.isConnected && state.isInternetReachable !== false))
      )
    );
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      const isActive = status === "active";
      focusManager.setFocused(isActive);

      if (isActive && accessToken) {
        void refreshSession().finally(() => {
          void queryClient.invalidateQueries({ queryKey: ["delivery-profile"] });
          void queryClient.invalidateQueries({
            queryKey: ["delivery-assignments"]
          });
          void registerPushDevice().catch(() => undefined);
        });
      }
    });

    return () => subscription.remove();
  }, [accessToken, queryClient, refreshSession, registerPushDevice]);

  useEffect(() => {
    if (!accessToken) {
      registeredToken.current = null;
      return;
    }

    void registerPushDevice().catch(() => undefined);
  }, [accessToken, registerPushDevice]);

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync()
      .then(openNotification)
      .catch(() => undefined);
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openNotification);

    return () => subscription.remove();
  }, [openNotification]);

  return null;
}
