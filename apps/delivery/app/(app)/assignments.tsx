import { useState } from "react";
import {
  FlatList,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";
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
  SectionCard
} from "../../components/ui/delivery-card";
import {
  errorMessage,
  useAppFeedback
} from "../../components/ui/feedback";
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
import { fonts } from "../../lib/theme";

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
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const numColumns = width >= 768 ? 2 : 1;

  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });
  const dashboardQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getDeliveryDashboard(accessToken ?? ""),
    queryKey: ["delivery-dashboard"],
    refetchInterval: 30_000
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
    queryKey: ["delivery-assignments", selectedStatus, search, sort, dateRange],
    refetchInterval: 15_000
  });
  const notificationsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listNotifications(accessToken ?? ""),
    queryKey: ["delivery-notifications"],
    refetchInterval: 30_000
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
  const activeFilterCount =
    (dateRange === "ALL" ? 0 : 1) + (sort === "NEWEST" ? 0 : 1);
  const filterSummary = `${dateRangeLabel(dateRange)} - ${sortLabel(sort)}`;

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
                <Text
                  style={[
                    styles.availabilityText,
                    !(profileQuery.data?.isOnline ?? false) &&
                      styles.availabilityTextOffline
                  ]}
                >
                  {profileQuery.data?.isOnline ? "Online" : "Offline"}
                </Text>
                <View style={styles.statusControls}>
                  <IconActionButton
                    compact
                    disabled={isRefreshing}
                    icon="refresh-outline"
                    label="Refresh deliveries"
                    onPress={refresh}
                    tone="secondary"
                  />
                  <Switch
                    accessibilityLabel="Delivery availability"
                    isDisabled={onlineMutation.isPending || profileQuery.isLoading}
                    isSelected={profileQuery.data?.isOnline ?? false}
                    onSelectedChange={(value) => onlineMutation.mutate(value)}
                  />
                </View>
              </View>
              <View style={styles.headerActions}>
                <WorkspaceBadge
                  icon="notifications-outline"
                  label="Alerts"
                  onPress={() => router.push("/(app)/notifications")}
                  tone={
                    (notificationsQuery.data?.unreadCount ?? 0) > 0
                      ? "warning"
                      : "neutral"
                  }
                  value={String(notificationsQuery.data?.unreadCount ?? 0)}
                />
                <WorkspaceBadge
                  icon="cloud-upload-outline"
                  label="Sync"
                  onPress={() => router.push("/(app)/sync")}
                  tone={
                    stalledCount > 0
                      ? "danger"
                      : queuedUpdates.length > 0
                        ? "warning"
                        : "neutral"
                  }
                  value={
                    queuedUpdates.length > 0 ? String(queuedUpdates.length) : "Ready"
                  }
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
                  placeholder="Search"
                  placeholderTextColor="#849C98"
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={searchDraft}
                />
                <IconActionButton
                  icon="search-outline"
                  label="Search deliveries"
                  onPress={() => setSearch(searchDraft.trim())}
                />
                <IconActionButton
                  badge={activeFilterCount}
                  icon="filter-outline"
                  label="Open delivery filters"
                  onPress={() => setFilterSheetVisible(true)}
                  tone="secondary"
                />
              </View>
              {search ? (
                <View style={styles.searchActions}>
                  <ActionButton
                    icon="close-outline"
                    label="Clear search"
                    onPress={() => {
                      setSearchDraft("");
                      setSearch("");
                    }}
                    tone="secondary"
                  />
                </View>
              ) : null}
              <Text selectable style={styles.filterSummary}>
                {filterSummary}
              </Text>
            </SectionCard>

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
            tintColor="#0F6F68"
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
      <DeliveryFilterSheet
        activeFilterCount={activeFilterCount}
        dateRange={dateRange}
        onApply={() => setFilterSheetVisible(false)}
        onDateRangeChange={setDateRange}
        onReset={() => {
          setDateRange("ALL");
          setSort("NEWEST");
        }}
        onSortChange={setSort}
        sort={sort}
        visible={filterSheetVisible}
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

function sortLabel(sort: "NEWEST" | "OLDEST") {
  return sort === "NEWEST" ? "Newest first" : "Oldest first";
}

function dateRangeLabel(range: "ALL" | "TODAY" | "7_DAYS") {
  switch (range) {
    case "ALL":
      return "All assigned dates";
    case "TODAY":
      return "Assigned today";
    case "7_DAYS":
      return "Last 7 assigned days";
  }
}

function IconActionButton({
  badge = 0,
  compact = false,
  disabled = false,
  icon,
  label,
  onPress,
  tone = "primary"
}: {
  badge?: number;
  compact?: boolean;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
}) {
  const secondary = tone === "secondary";

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconAction,
        compact && styles.iconActionCompact,
        secondary && styles.iconActionSecondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <Ionicons
        color={secondary ? "#123432" : "#FFFFFF"}
        name={icon}
        size={compact ? 20 : 22}
      />
      {badge > 0 ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function WorkspaceBadge({
  icon,
  label,
  onPress,
  tone,
  value
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone: "danger" | "neutral" | "warning";
  value: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.workspaceBadge,
        tone === "warning" && styles.workspaceBadgeWarning,
        tone === "danger" && styles.workspaceBadgeDanger,
        pressed && styles.pressed
      ]}
    >
      <Ionicons color={workspaceBadgeIconColor(tone)} name={icon} size={16} />
      <Text style={styles.workspaceBadgeLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[
          styles.workspaceBadgeValue,
          tone === "warning" && styles.workspaceBadgeValueWarning,
          tone === "danger" && styles.workspaceBadgeValueDanger
        ]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function workspaceBadgeIconColor(tone: "danger" | "neutral" | "warning") {
  if (tone === "danger") {
    return "#991B1B";
  }

  if (tone === "warning") {
    return "#92400E";
  }

  return "#0F6F68";
}

function DeliveryFilterSheet({
  activeFilterCount,
  dateRange,
  onApply,
  onDateRangeChange,
  onReset,
  onSortChange,
  sort,
  visible
}: {
  activeFilterCount: number;
  dateRange: "ALL" | "TODAY" | "7_DAYS";
  onApply: () => void;
  onDateRangeChange: (value: "ALL" | "TODAY" | "7_DAYS") => void;
  onReset: () => void;
  onSortChange: (value: "NEWEST" | "OLDEST") => void;
  sort: "NEWEST" | "OLDEST";
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onApply} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close delivery filters"
          accessibilityRole="button"
          onPress={onApply}
          style={styles.modalBackdrop}
        />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle}>Delivery filters</Text>
              <Text style={styles.sheetSubtitle}>
                {activeFilterCount > 0
                  ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                  : "Default delivery order"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close filters"
              accessibilityRole="button"
              onPress={onApply}
              style={({ pressed }) => [
                styles.sheetClose,
                pressed && styles.pressed
              ]}
            >
              <Ionicons color="#123432" name="close-outline" size={24} />
            </Pressable>
          </View>

          <FilterSection title="Assigned date">
            <View style={styles.optionGrid}>
              {(["ALL", "TODAY", "7_DAYS"] as const).map((value) => (
                <FilterOption
                  key={value}
                  label={dateRangeLabel(value)}
                  onPress={() => onDateRangeChange(value)}
                  selected={dateRange === value}
                />
              ))}
            </View>
          </FilterSection>

          <FilterSection title="Sort">
            <View style={styles.optionGrid}>
              {(["NEWEST", "OLDEST"] as const).map((value) => (
                <FilterOption
                  key={value}
                  label={sortLabel(value)}
                  onPress={() => onSortChange(value)}
                  selected={sort === value}
                />
              ))}
            </View>
          </FilterSection>

          <View style={styles.sheetActions}>
            <ActionButton
              icon="refresh-outline"
              label="Reset"
              onPress={onReset}
              style={styles.sheetActionButton}
              tone="secondary"
            />
            <ActionButton
              icon="checkmark-outline"
              label="Apply filters"
              onPress={onApply}
              style={styles.sheetActionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FilterOption({
  label,
  onPress,
  selected
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetOption,
        selected && styles.sheetOptionSelected,
        pressed && styles.pressed
      ]}
    >
      <Text style={selected ? styles.sheetOptionTextSelected : styles.sheetOptionText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  availabilityText: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: "900"
  },
  availabilityTextOffline: {
    color: "#607A77"
  },
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
  disabled: {
    opacity: 0.5
  },
  filterText: {
    color: "#2B4946",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "800"
  },
  filterPill: {
    alignItems: "center",
    backgroundColor: "#EEF6F5",
    borderColor: "#C4E4E0",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 9
  },
  filterPillSelected: {
    backgroundColor: "#E5F5F3",
    borderColor: "#0F6F68"
  },
  filters: {
    gap: 8,
    paddingRight: 0
  },
  filterSection: {
    gap: 10
  },
  filterSectionTitle: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 14,
    fontWeight: "900"
  },
  filterSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 8
  },
  filterSummary: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  header: {
    gap: 8
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  iconAction: {
    alignItems: "center",
    backgroundColor: "#0F6F68",
    borderColor: "#0F6F68",
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 46
  },
  iconActionCompact: {
    borderRadius: 999,
    height: 40,
    width: 40
  },
  iconActionSecondary: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C4E4E0"
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: "#B91C1C",
    borderColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: -5,
    top: -6,
    width: 20
  },
  iconBadgeText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: "900"
  },
  list: {
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 0,
    paddingTop: 0
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  modalBackdrop: {
    flex: 1
  },
  modalRoot: {
    backgroundColor: "rgba(7, 59, 56, 0.35)",
    flex: 1,
    justifyContent: "flex-end"
  },
  selectedFilterText: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
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
    color: "#55716E",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  datePill: {
    alignItems: "center",
    backgroundColor: "#EEF6F5",
    borderColor: "#C4E4E0",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 11,
    justifyContent: "center"
  },
  datePillSelected: {
    backgroundColor: "#E5F5F3",
    borderColor: "#0F6F68"
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pressed: {
    opacity: 0.72
  },
  loadingMore: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
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
    borderColor: "#C4E4E0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#123432",
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 9
  },
  searchRow: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  sheetActionButton: {
    flex: 1
  },
  sheetActions: {
    borderTopColor: "#CBDEDB",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    paddingTop: 12
  },
  sheetClose: {
    alignItems: "center",
    backgroundColor: "#EEF6F5",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#C4E4E0",
    borderRadius: 999,
    height: 4,
    width: 48
  },
  sheetHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  sheetOption: {
    alignItems: "center",
    backgroundColor: "#EEF6F5",
    borderColor: "#C4E4E0",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  sheetOptionSelected: {
    backgroundColor: "#E5F5F3",
    borderColor: "#0F6F68"
  },
  sheetOptionText: {
    color: "#2B4946",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "800"
  },
  sheetOptionTextSelected: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "900"
  },
  sheetSubtitle: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "700"
  },
  sheetTitle: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 20,
    fontWeight: "900"
  },
  sheetTitleBlock: {
    flex: 1,
    gap: 3
  },
  statusPanel: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between"
  },
  statusControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  tabletColumnItem: {
    maxWidth: "50%"
  },
  workspaceBadge: {
    alignItems: "center",
    backgroundColor: "#F3FAF9",
    borderColor: "#C4E4E0",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 8
  },
  workspaceBadgeDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5"
  },
  workspaceBadgeLabel: {
    color: "#2B4946",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "800"
  },
  workspaceBadgeValue: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "900",
    maxWidth: 48
  },
  workspaceBadgeValueDanger: {
    color: "#991B1B"
  },
  workspaceBadgeValueWarning: {
    color: "#92400E"
  },
  workspaceBadgeWarning: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D"
  }
});
