import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { Switch } from "heroui-native/switch";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { ConnectivityBanner } from "../../components/ui/connectivity-banner";
import {
  AssignmentCard,
  EmptyState,
  LoadingCards,
  MetricCard,
  SectionCard
} from "../../components/ui/delivery-card";
import {
  errorMessage,
  useAppFeedback
} from "../../components/ui/feedback";
import { formatCurrency } from "../../lib/api/status";
import {
  getMyProfile,
  listAssignments,
  updateOnlineStatus
} from "../../lib/api/delivery";
import {
  dashboardMetrics,
  deliveryFilterOptions,
  type DeliveryStatusFilter
} from "../../lib/delivery/dashboard";
import { useAuth } from "../../lib/auth/auth-context";
import { useStatusQueue } from "../../lib/offline/status-queue-context";
import { MAX_STATUS_UPDATE_ATTEMPTS } from "../../lib/offline/status-queue";

export default function AssignmentsScreen() {
  const { accessToken } = useAuth();
  const feedback = useAppFeedback();
  const queryClient = useQueryClient();
  const netInfo = useNetInfo();
  const { width } = useWindowDimensions();
  const { queuedUpdates } = useStatusQueue();
  const [selectedStatus, setSelectedStatus] =
    useState<DeliveryStatusFilter>("ALL");
  const numColumns = width >= 768 ? 2 : 1;

  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });
  const allAssignmentsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAssignments(accessToken ?? ""),
    queryKey: ["delivery-assignments", "all"]
  });
  const assignmentsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      listAssignments(
        accessToken ?? "",
        selectedStatus === "ALL" ? undefined : selectedStatus
      ),
    queryKey: ["delivery-assignments", selectedStatus]
  });
  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => updateOnlineStatus(accessToken ?? "", isOnline),
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: (profile) => {
      feedback.success(profile.isOnline ? "You are online." : "You are offline.");
      void queryClient.invalidateQueries({ queryKey: ["delivery-profile"] });
    }
  });

  const allAssignments = allAssignmentsQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.items ?? [];
  const metrics = dashboardMetrics(allAssignments);
  const filterOptions = deliveryFilterOptions(allAssignments);
  const isRefreshing =
    profileQuery.isFetching ||
    allAssignmentsQuery.isFetching ||
    assignmentsQuery.isFetching;
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;
  const stalledCount = queuedUpdates.filter(
    (item) => item.attempts >= MAX_STATUS_UPDATE_ATTEMPTS
  ).length;

  function refresh() {
    void profileQuery.refetch();
    void allAssignmentsQuery.refetch();
    void assignmentsQuery.refetch();
  }

  return (
    <Screen scroll={false}>
      <FlatList
        ListEmptyComponent={
          assignmentsQuery.isLoading ? (
            <LoadingCards />
          ) : assignmentsQuery.isError ? (
            <View style={styles.emptyWithAction}>
              <EmptyState
                icon="warning-outline"
                message={errorMessage(assignmentsQuery.error)}
                title="Deliveries could not load"
              />
              <ActionButton
                icon="refresh-outline"
                label="Try again"
                onPress={refresh}
                tone="secondary"
              />
            </View>
          ) : (
            <EmptyState
              icon="cube-outline"
              message="Pull to refresh or switch filters to check other delivery states."
              title="No deliveries in this view"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {isOffline ? (
              <ConnectivityBanner message="You are offline. Existing delivery updates can be queued and will sync after reconnection." />
            ) : null}
            {queuedUpdates.length > 0 ? (
              <ConnectivityBanner
                message={
                  stalledCount > 0
                    ? `${stalledCount} delivery update${
                        stalledCount === 1 ? "" : "s"
                      } need attention. Open the related delivery to retry or discard.`
                    : `${queuedUpdates.length} delivery update${
                        queuedUpdates.length === 1 ? "" : "s"
                      } waiting to sync.`
                }
                tone={stalledCount > 0 ? "danger" : "warning"}
              />
            ) : null}
            <SectionCard>
              <View style={styles.statusPanel}>
                <View style={styles.statusText}>
                  <Text style={styles.eyebrow}>Delivery workspace</Text>
                  <Text style={styles.name}>
                    {profileQuery.data?.fullName ?? "Delivery partner"}
                  </Text>
                  <Text style={styles.meta}>
                    {profileQuery.data?.isOnline ? "Online" : "Offline"}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Delivery availability"
                  isDisabled={onlineMutation.isPending || profileQuery.isLoading}
                  isSelected={profileQuery.data?.isOnline ?? false}
                  onSelectedChange={(value) => onlineMutation.mutate(value)}
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
                  onPress={refresh}
                  tone="secondary"
                />
              </View>
            </SectionCard>

            <View style={styles.metrics}>
              <MetricCard label="Active" value={String(metrics.activeCount)} />
              <MetricCard
                label="COD to collect"
                tone="warning"
                value={formatCurrency(metrics.codAmount)}
              />
              <MetricCard
                label="Completed"
                tone="success"
                value={String(metrics.completedCount)}
              />
              <MetricCard
                label="Issues"
                tone={metrics.issueCount > 0 ? "danger" : "default"}
                value={String(metrics.issueCount)}
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.filters}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {filterOptions.map((option) => {
                const selected = selectedStatus === option.status;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.status}
                    onPress={() => setSelectedStatus(option.status)}
                    style={[styles.filterPill, selected && styles.filterPillSelected]}
                  >
                    <Text style={selected ? styles.selectedFilterText : styles.filterText}>
                      {option.label} {option.count}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        contentContainerStyle={styles.list}
        data={assignments}
        columnWrapperStyle={numColumns > 1 ? styles.columns : undefined}
        keyExtractor={(item) => item.id}
        key={`assignments-${numColumns}`}
        numColumns={numColumns}
        refreshControl={
          <RefreshControl
            onRefresh={refresh}
            refreshing={isRefreshing}
            tintColor="#287c30"
          />
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.columnItem,
              numColumns > 1 && styles.tabletColumnItem
            ]}
          >
            <AssignmentCard
              assignment={item}
              onPress={() =>
                router.push({
                  params: { id: item.id },
                  pathname: "/(app)/assignments/[id]"
                })
              }
            />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  columnItem: {
    flex: 1
  },
  columns: {
    gap: 10
  },
  emptyWithAction: {
    alignSelf: "center",
    maxWidth: 430,
    width: "100%"
  },
  eyebrow: {
    color: "#287C30",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  filterText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800"
  },
  filterPill: {
    alignItems: "center",
    backgroundColor: "#EEF2F7",
    borderColor: "#CBD5E1",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 11
  },
  filterPillSelected: {
    backgroundColor: "#E8F5EC",
    borderColor: "#287C30"
  },
  filters: {
    gap: 8,
    paddingRight: 0
  },
  header: {
    gap: 10
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  list: {
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 0,
    paddingTop: 0
  },
  meta: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700"
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  name: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900"
  },
  selectedFilterText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "900"
  },
  statusPanel: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  statusText: {
    flex: 1,
    gap: 4
  },
  tabletColumnItem: {
    maxWidth: "50%"
  }
});
