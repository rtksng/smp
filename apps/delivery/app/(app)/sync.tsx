import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { ConnectivityBanner } from "../../components/ui/connectivity-banner";
import { EmptyState, SectionCard } from "../../components/ui/delivery-card";
import { confirmAction } from "../../components/ui/feedback";
import { formatDateTime } from "../../lib/delivery/dashboard";
import { MAX_STATUS_UPDATE_ATTEMPTS } from "../../lib/offline/status-queue";
import { useStatusQueue } from "../../lib/offline/status-queue-context";
import { fonts } from "../../lib/theme";

export default function OfflineSyncScreen() {
  const netInfo = useNetInfo();
  const { discardUpdate, queuedUpdates, retryUpdate } = useStatusQueue();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;
  const stalled = queuedUpdates.filter(
    (item) => item.attempts >= MAX_STATUS_UPDATE_ATTEMPTS
  );

  return (
    <Screen>
      <ConnectivityBanner
        message={
          isOffline
            ? "You are offline. Updates remain securely queued on this device."
            : queuedUpdates.length > 0
              ? "You are online. Eligible updates will retry automatically."
              : "You are online and fully synced."
        }
        tone={stalled.length > 0 ? "danger" : "warning"}
      />

      <SectionCard>
        <View style={styles.summary}>
          <Summary label="Waiting" value={queuedUpdates.length} />
          <Summary label="Need attention" value={stalled.length} />
        </View>
        {queuedUpdates.length > 0 ? (
          <ActionButton
            disabled={isOffline}
            icon="refresh-outline"
            label="Retry all"
            onPress={() => {
              void Promise.all(queuedUpdates.map((item) => retryUpdate(item.id)));
            }}
            tone="secondary"
          />
        ) : null}
      </SectionCard>

      {queuedUpdates.length === 0 ? (
        <EmptyState
          icon="cloud-done-outline"
          message="All delivery status updates have reached the server."
          title="Everything is synced"
        />
      ) : (
        queuedUpdates.map((item) => {
          const needsAttention = item.attempts >= MAX_STATUS_UPDATE_ATTEMPTS;

          return (
            <SectionCard key={item.id}>
              <View style={styles.itemTop}>
                <View style={styles.itemText}>
                  <Text selectable style={styles.assignmentId}>
                    Delivery {item.assignmentId.slice(0, 8)}
                  </Text>
                  <Text selectable style={styles.meta}>
                    {item.payload.status.replaceAll("_", " ")} - queued {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                <Text style={needsAttention ? styles.failed : styles.waiting}>
                  {needsAttention ? "Needs attention" : `Attempt ${item.attempts}`}
                </Text>
              </View>
              {item.lastAttemptedAt ? (
                <Text selectable style={styles.meta}>
                  Last attempt {formatDateTime(item.lastAttemptedAt)}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <ActionButton
                  label="Open delivery"
                  onPress={() =>
                    router.push({
                      params: { id: item.assignmentId },
                      pathname: "/(app)/assignments/[id]"
                    })
                  }
                  tone="secondary"
                />
                <ActionButton
                  disabled={isOffline}
                  label="Retry"
                  onPress={() => void retryUpdate(item.id)}
                  tone="secondary"
                />
                <ActionButton
                  label="Discard"
                  onPress={() =>
                    confirmAction({
                      body: "This removes the queued update from this device. The server status will not change.",
                      confirmLabel: "Discard",
                      destructive: true,
                      onConfirm: () => void discardUpdate(item.id),
                      title: "Discard queued update?"
                    })
                  }
                  tone="danger"
                />
              </View>
            </SectionCard>
          );
        })
      )}

      <Text selectable style={styles.proofNote}>
        Proof-of-delivery photos are never queued offline. Complete delivery only after reconnecting so the image can upload safely.
      </Text>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <Text selectable style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  assignmentId: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 15,
    fontWeight: "900"
  },
  failed: {
    color: "#B91C1C",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "900"
  },
  itemText: { flex: 1, gap: 3 },
  itemTop: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  meta: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  proofNote: {
    color: "#55716E",
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 4
  },
  summary: { flexDirection: "row", gap: 8 },
  summaryItem: {
    backgroundColor: "#F3FAF9",
    borderRadius: 8,
    flex: 1,
    gap: 2,
    padding: 12
  },
  summaryLabel: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 22,
    fontWeight: "900"
  },
  waiting: {
    color: "#92400E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "900"
  }
});
