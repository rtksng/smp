import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import {
  EmptyState,
  MetricCard,
  SectionCard
} from "../../components/ui/delivery-card";
import { errorMessage } from "../../components/ui/feedback";
import {
  getCashSummary,
  getDeliveryDashboard,
  getEarnings
} from "../../lib/api/delivery";
import { formatCurrency } from "../../lib/api/status";
import type {
  DeliveryEarningsSummary,
  DeliveryLedgerEntry
} from "../../lib/api/types";
import { useAuth } from "../../lib/auth/auth-context";
import { formatDateTime } from "../../lib/delivery/dashboard";
import {
  formatLedgerAmount,
  formatPayStructure,
  isLedgerCredit,
  ledgerEntryTitle,
  payCreditNote
} from "../../lib/delivery/earnings";
import { fonts } from "../../lib/theme";

export default function CashScreen() {
  const { accessToken } = useAuth();
  const cashQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getCashSummary(accessToken ?? ""),
    queryKey: ["delivery-cash"],
    refetchInterval: 30_000
  });
  const dashboardQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getDeliveryDashboard(accessToken ?? ""),
    queryKey: ["delivery-dashboard"],
    refetchInterval: 30_000
  });
  const earningsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getEarnings(accessToken ?? ""),
    queryKey: ["delivery-earnings"],
    refetchInterval: 30_000
  });

  if (cashQuery.isLoading) {
    return (
      <Screen>
        <EmptyState icon="wallet-outline" title="Loading cash summary" />
      </Screen>
    );
  }

  if (!cashQuery.data) {
    return (
      <Screen>
        <EmptyState
          icon="warning-outline"
          message={cashQuery.isError ? errorMessage(cashQuery.error) : undefined}
          title="Cash summary unavailable"
        />
        <ActionButton
          icon="refresh-outline"
          label="Try again"
          onPress={() => void cashQuery.refetch()}
          tone="secondary"
        />
      </Screen>
    );
  }

  const summary = cashQuery.data;
  const dashboard = dashboardQuery.data ?? {
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

  return (
    <Screen>
      <View style={styles.metrics}>
        <MetricCard
          label="Cash in hand"
          tone={summary.cashInHand > 0 ? "warning" : "default"}
          value={formatCurrency(summary.cashInHand)}
        />
        <MetricCard
          label="Pending handover"
          value={String(summary.pendingCount)}
        />
        <MetricCard
          label="Submitted"
          value={formatCurrency(summary.submittedAmount)}
        />
        <MetricCard
          label="Settled"
          tone="success"
          value={formatCurrency(summary.settledAmount)}
        />
      </View>

      {/* Completed deliveries are shown with earnings below, so they are not repeated here. */}
      <SectionCard title="Delivery summary">
        <View style={styles.metrics}>
          <MetricCard label="Active" value={String(dashboard.activeCount)} />
          <MetricCard
            label="COD to collect"
            tone="warning"
            value={formatCurrency(dashboard.codToCollect)}
          />
          <MetricCard
            label="Issues"
            tone={dashboard.issueCount > 0 ? "danger" : "default"}
            value={String(dashboard.issueCount)}
          />
        </View>
      </SectionCard>

      {earningsQuery.data ? (
        <EarningsSections earnings={earningsQuery.data} />
      ) : (
        <SectionCard title="Earnings">
          {earningsQuery.isLoading ? (
            <EmptyState icon="wallet-outline" title="Loading earnings" />
          ) : (
            <>
              <EmptyState
                icon="warning-outline"
                message={
                  earningsQuery.isError ? errorMessage(earningsQuery.error) : undefined
                }
                title="Earnings unavailable"
              />
              <ActionButton
                icon="refresh-outline"
                label="Try again"
                onPress={() => void earningsQuery.refetch()}
                tone="secondary"
              />
            </>
          )}
        </SectionCard>
      )}

      <SectionCard title="COD collection history">
        {summary.items.length === 0 ? (
          <Text style={styles.emptyText}>No COD cash has been collected yet.</Text>
        ) : (
          summary.items.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.assignmentId}
              onPress={() => openAssignment(item.assignmentId)}
              style={({ pressed }) => [
                styles.cashRow,
                pressed && styles.pressed
              ]}
            >
              <View style={styles.cashMain}>
                <Text selectable style={styles.orderNumber}>{item.orderNumber}</Text>
                <Text selectable style={styles.meta}>
                  {formatDateTime(item.collectedAt)} · {settlementLabel(item.settlementStatus)}
                </Text>
              </View>
              <Text selectable style={styles.amount}>{formatCurrency(item.amount)}</Text>
            </Pressable>
          ))
        )}
      </SectionCard>
    </Screen>
  );
}

function EarningsSections({ earnings }: { earnings: DeliveryEarningsSummary }) {
  const creditNote = payCreditNote(earnings.payment);

  return (
    <>
      <SectionCard title="Your pay">
        <Text selectable style={creditNote ? styles.payValue : styles.payNotSet}>
          {formatPayStructure(earnings.payment)}
        </Text>
        {creditNote ? (
          <Text selectable style={styles.helper}>{creditNote}</Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Earnings">
        <View style={styles.metrics}>
          <MetricCard
            label="Available balance"
            tone="success"
            value={formatCurrency(earnings.wallet.balance)}
          />
          <MetricCard
            label="Total earned"
            value={formatCurrency(earnings.wallet.totalEarnings)}
          />
          <MetricCard
            label="Commission earned"
            value={formatCurrency(earnings.totals.commissionEarnings)}
          />
          <MetricCard
            label="Salary credited"
            value={formatCurrency(earnings.totals.salaryEarnings)}
          />
          <MetricCard
            label="Paid out"
            value={formatCurrency(earnings.totals.paidOut)}
          />
          <MetricCard
            accessibilityHint="Opens your delivered orders"
            label="Completed deliveries"
            onPress={() =>
              router.push({
                params: { status: "DELIVERED" },
                pathname: "/(app)/assignments"
              })
            }
            tone="success"
            value={String(earnings.totals.completedDeliveries)}
          />
        </View>
        <Text selectable style={styles.helper}>
          Earnings are calculated automatically. Payouts are controlled by delivery operations. COD settlement is tracked separately below.
        </Text>
      </SectionCard>

      <SectionCard title="Payment history">
        {earnings.payouts.length === 0 ? (
          <Text style={styles.emptyText}>No payouts recorded yet.</Text>
        ) : (
          earnings.payouts.map((payout) => (
            <View key={payout.id} style={styles.cashRow}>
              <View style={styles.cashMain}>
                <Text selectable style={styles.orderNumber}>{payout.description}</Text>
                <Text selectable style={styles.ledgerMeta}>{ledgerMeta(payout)}</Text>
              </View>
              <Text selectable style={styles.amount}>{formatCurrency(payout.amount)}</Text>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Earnings activity">
        {earnings.entries.length === 0 ? (
          <Text style={styles.emptyText}>No earnings recorded yet.</Text>
        ) : (
          earnings.entries.map((entry) => <LedgerRow entry={entry} key={entry.id} />)
        )}
      </SectionCard>
    </>
  );
}

function LedgerRow({ entry }: { entry: DeliveryLedgerEntry }) {
  const assignmentId = entry.deliveryAssignmentId;
  const content = (
    <>
      <View style={styles.cashMain}>
        <Text selectable style={styles.orderNumber}>{ledgerEntryTitle(entry)}</Text>
        <Text selectable style={styles.ledgerMeta}>{ledgerMeta(entry)}</Text>
      </View>
      <Text
        selectable
        style={isLedgerCredit(entry) ? styles.earningAmount : styles.payoutAmount}
      >
        {formatLedgerAmount(entry)}
      </Text>
    </>
  );

  if (!assignmentId) {
    return <View style={styles.cashRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityHint="Opens the delivery for this earning"
      accessibilityRole="button"
      onPress={() => openAssignment(assignmentId)}
      style={({ pressed }) => [styles.cashRow, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

function openAssignment(id: string) {
  router.push({
    params: { id },
    pathname: "/(app)/assignments/[id]"
  });
}

function ledgerMeta(entry: DeliveryLedgerEntry) {
  return [
    formatDateTime(entry.createdAt),
    // Salary rows are titled by month, so keep the operations note visible here.
    entry.type === "SALARY" ? entry.description : null,
    entry.reference
  ]
    .filter(Boolean)
    .join(" · ");
}

function settlementLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

const styles = StyleSheet.create({
  amount: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 15,
    fontWeight: "900"
  },
  cashMain: { flex: 1, gap: 3 },
  cashRow: {
    alignItems: "center",
    borderTopColor: "#CBDEDB",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    minHeight: 50,
    paddingVertical: 6
  },
  emptyText: {
    color: "#55716E",
    fontFamily: fonts.body,
    fontSize: 14,
    paddingVertical: 10,
    textAlign: "center"
  },
  earningAmount: {
    color: "#0F6F68",
    fontFamily: fonts.headingBold,
    fontSize: 15,
    fontWeight: "900"
  },
  helper: {
    color: "#55716E",
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19
  },
  ledgerMeta: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "700"
  },
  meta: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  orderNumber: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 14,
    fontWeight: "900"
  },
  payNotSet: {
    color: "#92400E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  payoutAmount: {
    color: "#9A3412",
    fontFamily: fonts.headingBold,
    fontSize: 15,
    fontWeight: "900"
  },
  payValue: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 18,
    fontWeight: "900"
  },
  pressed: { opacity: 0.72 }
});
