import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { Switch } from "heroui-native/switch";
import { router } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
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
  getDeliveryDashboard,
  listAssignments,
  listNotifications,
  updateOnlineStatus
} from "../../lib/api/delivery";
import {
  deliveryFilterOptionsFromCounts,
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
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [dateRange, setDateRange] = useState<"ALL" | "TODAY" | "7_DAYS">("ALL");
  const numColumns = width >= 768 ? 2 : 1;

  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });
  const dashboardQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getDeliveryDashboard(accessToken ?? ""),
    queryKey: ["delivery-dashboard"]
  });
  const assignmentsQuery = useInfiniteQuery({
    enabled: Boolean(accessToken),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const dateFilter = assignmentDateFilter(dateRange);

      return listAssignments(accessToken ?? "", {
          ...dateFilter,
          limit: 20,
          page: pageParam,
          search: search || undefined,
          sort,
          status: selectedStatus === "ALL" ? undefined : selectedStatus
        });
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    queryKey: ["delivery-assignments", selectedStatus, search, sort, dateRange]
  });
  const notificationsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listNotifications(accessToken ?? ""),
    queryKey: ["delivery-notifications"]
  });
  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => updateOnlineStatus(accessToken ?? "", isOnline),
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: (profile) => {
      feedback.success(profile.isOnline ? "You are online." : "You are offline.");
      void queryClient.invalidateQueries({ queryKey: ["delivery-profile"] });
    }
  });

  const assignments = assignmentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const metrics = dashboardQuery.data ?? {
    activeCount: 0,
    codToCollect: 0,
    completedCount: 0,
    issueCount: 0,
    statusCounts: {
      ACCEPTED: 0,
      ASSIGNED: 0,
      CANCELLED: 0,
      DELIVERED: 0,
      FAILED: 0,
      OUT_FOR_DELIVERY: 0,
      PICKED_UP: 0
    }
  };
  const totalAssignments = Object.values(metrics.statusCounts).reduce(
    (total, count) => total + count,
    0
  );
  const filterOptions = deliveryFilterOptionsFromCounts(
    metrics.statusCounts,
    totalAssignments
  );
  const isRefreshing =
    profileQuery.isFetching ||
    dashboardQuery.isFetching ||
    assignmentsQuery.isFetching;
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;
  const stalledCount = queuedUpdates.filter(
    (item) => item.attempts >= MAX_STATUS_UPDATE_ATTEMPTS
  ).length;

  function refresh() {
    void profileQuery.refetch();
    void dashboardQuery.refetch();
    void assignmentsQuery.refetch();
    void notificationsQuery.refetch();
  }

  return (
    <Screen scroll={false}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
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
                  icon="notifications-outline"
                  label={`Alerts ${notificationsQuery.data?.unreadCount ?? 0}`}
                  onPress={() => router.push("/(app)/notifications")}
                  tone="secondary"
                />
                <ActionButton
                  icon="cloud-upload-outline"
                  label="Sync"
                  onPress={() => router.push("/(app)/sync")}
                  tone="secondary"
                />
              </View>
            </SectionCard>

            <SectionCard>
              <View style={styles.searchRow}>
                <TextInput
                  accessibilityLabel="Search deliveries"
                  autoCorrect={false}
                  onChangeText={setSearchDraft}
                  onSubmitEditing={() => setSearch(searchDraft.trim())}
                  placeholder="Order, customer, business or mobile"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={searchDraft}
                />
                <ActionButton
                  icon="search-outline"
                  label="Search"
                  onPress={() => setSearch(searchDraft.trim())}
                />
              </View>
              <View style={styles.searchActions}>
                {search ? (
                  <ActionButton
                    icon="close-outline"
                    label="Clear search"
                    onPress={() => {
                      setSearchDraft("");
                      setSearch("");
                    }}
                    tone="secondary"
                  />
                ) : null}
                <ActionButton
                  icon="swap-vertical-outline"
                  label={sort === "NEWEST" ? "Newest first" : "Oldest first"}
                  onPress={() =>
                    setSort((value) => value === "NEWEST" ? "OLDEST" : "NEWEST")
                  }
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
              <View style={styles.dateFilters}>
                <Text style={styles.dateLabel}>Assigned date</Text>
                {(["ALL", "TODAY", "7_DAYS"] as const).map((value) => {
                  const selected = dateRange === value;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={value}
                      onPress={() => setDateRange(value)}
                      style={[styles.datePill, selected && styles.datePillSelected]}
                    >
                      <Text style={selected ? styles.selectedFilterText : styles.filterText}>
                        {value === "ALL" ? "All dates" : value === "TODAY" ? "Today" : "Last 7 days"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>

            <View style={styles.metrics}>
              <MetricCard label="Active" value={String(metrics.activeCount)} />
              <MetricCard
                label="COD to collect"
                tone="warning"
                value={formatCurrency(metrics.codToCollect)}
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
        onEndReached={() => {
          if (assignmentsQuery.hasNextPage && !assignmentsQuery.isFetchingNextPage) {
            void assignmentsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
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
        ListFooterComponent={
          assignmentsQuery.isFetchingNextPage ? (
            <Text style={styles.loadingMore}>Loading more deliveries…</Text>
          ) : null
        }
      />
    </Screen>
  );
}

function assignmentDateFilter(range: "ALL" | "TODAY" | "7_DAYS") {
  if (range === "ALL") {
    return {};
  }

  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  if (range === "TODAY") {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
  }

  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  return { dateFrom: from.toISOString() };
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
  dateFilters: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  dateLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  datePill: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 11,
    justifyContent: "center"
  },
  datePillSelected: {
    backgroundColor: "#E8F5EC",
    borderColor: "#287C30"
  },
  loadingMore: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 16,
    textAlign: "center"
  },
  searchActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0F172A",
    flex: 1,
    fontSize: 15,
    minHeight: 50,
    minWidth: 190,
    paddingHorizontal: 12
  },
  searchRow: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
