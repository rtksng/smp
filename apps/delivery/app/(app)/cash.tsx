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
import { getCashSummary } from "../../lib/api/delivery";
import { formatCurrency } from "../../lib/api/status";
import { useAuth } from "../../lib/auth/auth-context";
import { formatDateTime } from "../../lib/delivery/dashboard";

export default function CashScreen() {
  const { accessToken } = useAuth();
  const cashQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getCashSummary(accessToken ?? ""),
    queryKey: ["delivery-cash"]
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

      <SectionCard title="Earnings">
        <MoneyRow label="Available balance" value={summary.wallet.balance} />
        <MoneyRow label="Lifetime earnings" value={summary.wallet.totalEarnings} />
        <Text selectable style={styles.helper}>
          Payouts are controlled by delivery operations. COD settlement is tracked separately below.
        </Text>
      </SectionCard>

      <SectionCard title="Earnings and payouts">
        {summary.ledgerEntries.length === 0 ? (
          <Text style={styles.emptyText}>No earning or payout entries posted yet.</Text>
        ) : (
          summary.ledgerEntries.map((entry) => (
            <View key={entry.id} style={styles.cashRow}>
              <View style={styles.cashMain}>
                <Text selectable style={styles.orderNumber}>{entry.description}</Text>
                <Text selectable style={styles.meta}>
                  {formatDateTime(entry.createdAt)}
                  {entry.reference ? ` · ${entry.reference}` : ""}
                </Text>
              </View>
              <Text
                selectable
                style={entry.type === "PAYOUT" ? styles.payoutAmount : styles.earningAmount}
              >
                {entry.type === "PAYOUT" ? "−" : "+"}{formatCurrency(entry.amount)}
              </Text>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="COD collection history">
        {summary.items.length === 0 ? (
          <Text style={styles.emptyText}>No COD cash has been collected yet.</Text>
        ) : (
          summary.items.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.assignmentId}
              onPress={() =>
                router.push({
                  params: { id: item.assignmentId },
                  pathname: "/(app)/assignments/[id]"
                })
              }
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

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.moneyRow}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text selectable style={styles.moneyValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

function settlementLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

const styles = StyleSheet.create({
  amount: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  cashMain: { flex: 1, gap: 3 },
  cashRow: { alignItems: "center", borderTopColor: "#E2E8F0", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8, minHeight: 58, paddingVertical: 8 },
  emptyText: { color: "#64748B", fontSize: 14, paddingVertical: 12, textAlign: "center" },
  earningAmount: { color: "#166534", fontSize: 15, fontWeight: "900" },
  helper: { color: "#64748B", fontSize: 13, lineHeight: 19 },
  meta: { color: "#64748B", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  moneyLabel: { color: "#64748B", fontSize: 14, fontWeight: "700" },
  moneyRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  moneyValue: { color: "#0F172A", fontSize: 16, fontWeight: "900" },
  orderNumber: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  payoutAmount: { color: "#9A3412", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.72 }
});
