import { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { StatusPill } from "../../components/StatusPill";
import {
  assignmentDestination,
  formatCurrency
} from "../../lib/api/status";
import type { DeliveryAssignment } from "../../lib/api/types";
import {
  getMyProfile,
  listAssignments,
  registerDevice,
  updateOnlineStatus
} from "../../lib/api/delivery";
import { getExpoPushRegistration } from "../../lib/device/native";
import { useAuth } from "../../lib/auth/auth-context";

export default function AssignmentsScreen() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });
  const assignmentsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAssignments(accessToken ?? ""),
    queryKey: ["delivery-assignments"]
  });
  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => updateOnlineStatus(accessToken ?? "", isOnline),
    onError: showError,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-profile"] });
    }
  });

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    getExpoPushRegistration()
      .then((registration) =>
        registration
          ? registerDevice(accessToken, {
              notificationsEnabled: true,
              platform: registration.platform,
              pushToken: registration.pushToken
            })
          : undefined
      )
      .catch(() => undefined);
  }, [accessToken]);

  const isRefreshing = profileQuery.isFetching || assignmentsQuery.isFetching;
  const assignments = assignmentsQuery.data?.items ?? [];

  return (
    <Screen scroll={false}>
      <FlatList
        ListEmptyComponent={
          assignmentsQuery.isLoading ? (
            <ActivityIndicator color="#287c30" style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons color="#64748B" name="cube-outline" size={28} />
              <Text style={styles.emptyText}>No assigned deliveries</Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.statusPanel}>
              <View style={styles.statusText}>
                <Text style={styles.name}>
                  {profileQuery.data?.fullName ?? "Delivery partner"}
                </Text>
                <Text style={styles.meta}>
                  {profileQuery.data?.isOnline ? "Online" : "Offline"}
                </Text>
              </View>
              <Switch
                ios_backgroundColor="#CBD5E1"
                onValueChange={(value) => onlineMutation.mutate(value)}
                trackColor={{ false: "#CBD5E1", true: "#9fe4a4" }}
                value={profileQuery.data?.isOnline ?? false}
              />
            </View>
            <View style={styles.headerActions}>
              <ActionButton
                icon="person-circle-outline"
                label="Profile"
                onPress={() => router.push("/(app)/profile")}
                tone="secondary"
              />
              <ActionButton
                icon="refresh-outline"
                label="Refresh"
                loading={isRefreshing}
                onPress={() => {
                  void profileQuery.refetch();
                  void assignmentsQuery.refetch();
                }}
                tone="secondary"
              />
            </View>
          </View>
        }
        contentContainerStyle={styles.list}
        data={assignments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void profileQuery.refetch();
              void assignmentsQuery.refetch();
            }}
            refreshing={isRefreshing}
            tintColor="#287c30"
          />
        }
        renderItem={({ item }) => <AssignmentCard assignment={item} />}
      />
    </Screen>
  );
}

function AssignmentCard({ assignment }: { assignment: DeliveryAssignment }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          params: { id: assignment.id },
          pathname: "/(app)/assignments/[id]"
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTitleBlock}>
          <Text numberOfLines={1} style={styles.orderNumber}>
            {assignment.orderNumber}
          </Text>
          <Text numberOfLines={1} style={styles.customer}>
            {assignment.customer.businessName ?? assignment.customer.fullName}
          </Text>
        </View>
        <StatusPill status={assignment.status} />
      </View>

      <View style={styles.detailRow}>
        <Ionicons color="#475569" name="location-outline" size={16} />
        <Text numberOfLines={2} style={styles.detailText}>
          {assignmentDestination(assignment)}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons color="#475569" name="cash-outline" size={16} />
        <Text style={styles.detailText}>
          {assignment.payment.method === "COD"
            ? `COD ${formatCurrency(assignment.payment.codAmount)}`
            : "Paid online"}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons color="#475569" name="cube-outline" size={16} />
        <Text numberOfLines={1} style={styles.detailText}>
          {assignment.items.length} item{assignment.items.length === 1 ? "" : "s"}
        </Text>
      </View>
    </Pressable>
  );
}

function showError(error: unknown) {
  Alert.alert("Request failed", error instanceof Error ? error.message : "Try again.");
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  cardPressed: {
    opacity: 0.78
  },
  cardTitleBlock: {
    flex: 1,
    gap: 5,
    minWidth: 0
  },
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  customer: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600"
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  detailText: {
    color: "#334155",
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 48
  },
  emptyText: {
    color: "#64748B",
    fontSize: 15,
    fontWeight: "700"
  },
  header: {
    gap: 12
  },
  headerActions: {
    flexDirection: "row",
    gap: 10
  },
  list: {
    gap: 12,
    padding: 16,
    paddingBottom: 28
  },
  loader: {
    paddingVertical: 48
  },
  meta: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700"
  },
  name: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900"
  },
  orderNumber: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "900"
  },
  statusPanel: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 14
  },
  statusText: {
    flex: 1,
    gap: 4
  }
});
