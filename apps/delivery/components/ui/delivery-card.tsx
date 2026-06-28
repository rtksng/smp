import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps
} from "react-native";
import { Card } from "heroui-native/card";
import { Skeleton } from "heroui-native/skeleton";
import { StatusPill } from "../StatusPill";
import {
  assignmentDestination,
  formatCurrency
} from "../../lib/api/status";
import type { DeliveryAssignment } from "../../lib/api/types";
import { formatDateTime, nextActionLabel } from "../../lib/delivery/dashboard";

export function MetricCard({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
  value: string;
}) {
  return (
    <Card className="min-w-[145px] flex-1 rounded-xl border border-slate-200 bg-white">
      <Card.Body className="gap-1 px-2 py-2.5">
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, toneStyles[tone]]}>{value}</Text>
      </Card.Body>
    </Card>
  );
}

export function SectionCard({
  children,
  title
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Card className="w-full rounded-xl border border-slate-200 bg-white">
      <Card.Body className="gap-2 px-2 py-2.5">
        {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
        {children}
      </Card.Body>
    </Card>
  );
}

export function AssignmentCard({
  assignment,
  ...props
}: PressableProps & {
  assignment: DeliveryAssignment;
}) {
  const customer = assignment.customer.businessName ?? assignment.customer.fullName;

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [pressed && styles.pressed]}
      {...props}
    >
      <Card className="w-full rounded-xl border border-slate-200 bg-white">
        <Card.Body className="gap-2 px-2 py-2.5">
          <View style={styles.cardTop}>
            <View style={styles.titleBlock}>
              <Text numberOfLines={1} style={styles.orderNumber}>
                {assignment.orderNumber}
              </Text>
              <Text numberOfLines={1} style={styles.customer}>
                {customer}
              </Text>
            </View>
            <StatusPill status={assignment.status} />
          </View>
          <InfoLine icon="location-outline" value={assignmentDestination(assignment)} />
          <InfoLine
            icon="cash-outline"
            value={
              assignment.payment.method === "COD"
                ? `COD ${formatCurrency(assignment.payment.codAmount)}`
                : "Paid online"
            }
          />
          <InfoLine
            icon="cube-outline"
            value={`${assignment.items.length} item${
              assignment.items.length === 1 ? "" : "s"
            }`}
          />
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Assigned {formatDateTime(assignment.assignedAt)}
            </Text>
            <Text style={styles.nextAction}>{nextActionLabel(assignment.status)}</Text>
          </View>
        </Card.Body>
      </Card>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  message,
  title
}: {
  icon: keyof typeof Ionicons.glyphMap;
  message?: string;
  title: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons color="#64748B" name={icon} size={30} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

export function LoadingCards() {
  return (
    <View style={styles.loadingStack}>
      {[0, 1, 2].map((item) => (
        <Skeleton className="h-32 w-full rounded-xl" isLoading key={item} />
      ))}
    </View>
  );
}

function InfoLine({
  icon,
  value
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
}) {
  return (
    <View style={styles.infoLine}>
      <Ionicons color="#475569" name={icon} size={16} />
      <Text numberOfLines={2} style={styles.infoText}>
        {value}
      </Text>
    </View>
  );
}

const toneStyles = StyleSheet.create({
  danger: {
    color: "#B91C1C"
  },
  default: {
    color: "#0F172A"
  },
  success: {
    color: "#166534"
  },
  warning: {
    color: "#92400E"
  }
});

const styles = StyleSheet.create({
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  customer: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700"
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 48
  },
  emptyMessage: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  footerRow: {
    alignItems: "center",
    borderTopColor: "#E2E8F0",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 9
  },
  footerText: {
    color: "#64748B",
    flex: 1,
    fontSize: 12,
    fontWeight: "700"
  },
  infoLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  infoText: {
    color: "#334155",
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  loadingStack: {
    gap: 10
  },
  metricLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metricValue: {
    fontSize: 21,
    fontWeight: "900"
  },
  nextAction: {
    color: "#287C30",
    fontSize: 12,
    fontWeight: "900"
  },
  orderNumber: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900"
  },
  titleBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0
  }
});
