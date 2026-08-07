import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { EmptyState, SectionCard } from "../../components/ui/delivery-card";
import { errorMessage, useAppFeedback } from "../../components/ui/feedback";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../../lib/api/delivery";
import type { DeliveryNotification } from "../../lib/api/types";
import { useAuth } from "../../lib/auth/auth-context";
import { formatDateTime } from "../../lib/delivery/dashboard";

export default function NotificationsScreen() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const notificationsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listNotifications(accessToken ?? ""),
    queryKey: ["delivery-notifications"]
  });
  const readMutation = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(accessToken ?? "", notificationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["delivery-notifications"] })
  });
  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(accessToken ?? ""),
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: () => {
      feedback.success("All notifications marked read.");
      void queryClient.invalidateQueries({ queryKey: ["delivery-notifications"] });
    }
  });

  if (notificationsQuery.isLoading) {
    return (
      <Screen>
        <EmptyState icon="notifications-outline" title="Loading notifications" />
      </Screen>
    );
  }

  if (!notificationsQuery.data) {
    return (
      <Screen>
        <EmptyState
          icon="warning-outline"
          message={notificationsQuery.isError ? errorMessage(notificationsQuery.error) : undefined}
          title="Notifications unavailable"
        />
        <ActionButton
          label="Try again"
          onPress={() => void notificationsQuery.refetch()}
          tone="secondary"
        />
      </Screen>
    );
  }

  const notifications = notificationsQuery.data;

  return (
    <Screen>
      <SectionCard>
        <View style={styles.summaryRow}>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>Assignment updates</Text>
            <Text selectable style={styles.summaryMeta}>
              {notifications.unreadCount} unread
            </Text>
          </View>
          <ActionButton
            disabled={notifications.unreadCount === 0}
            label="Mark all read"
            loading={readAllMutation.isPending}
            onPress={() => readAllMutation.mutate()}
            tone="secondary"
          />
        </View>
      </SectionCard>

      {notifications.items.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          message="New assignments and delivery operations updates will appear here."
          title="No notifications"
        />
      ) : (
        notifications.items.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onPress={() => {
              if (!notification.isRead) {
                readMutation.mutate(notification.id);
              }
              if (notification.assignmentId) {
                router.push({
                  params: { id: notification.assignmentId },
                  pathname: "/(app)/assignments/[id]"
                });
              }
            }}
          />
        ))
      )}
    </Screen>
  );
}

function NotificationRow({
  notification,
  onPress
}: {
  notification: DeliveryNotification;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.notification,
        !notification.isRead && styles.unread,
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.dot, notification.isRead && styles.dotRead]} />
      <View style={styles.notificationText}>
        <Text selectable style={styles.notificationTitle}>{notification.title}</Text>
        <Text selectable style={styles.notificationBody}>{notification.body}</Text>
        <Text selectable style={styles.time}>{formatDateTime(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dot: { backgroundColor: "#287C30", borderRadius: 5, height: 10, marginTop: 6, width: 10 },
  dotRead: { backgroundColor: "#CBD5E1" },
  notification: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  notificationBody: { color: "#475569", fontSize: 14, lineHeight: 20 },
  notificationText: { flex: 1, gap: 4 },
  notificationTitle: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.72 },
  summaryMeta: { color: "#64748B", fontSize: 13, fontWeight: "700" },
  summaryRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  summaryText: { flex: 1, gap: 3 },
  summaryTitle: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  time: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  unread: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }
});
