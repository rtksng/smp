import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps
} from "react-native";
import { Skeleton } from "heroui-native/skeleton";
import { StatusPill } from "../StatusPill";
import {
  assignmentDestination,
  formatCurrency
} from "../../lib/api/status";
import type { DeliveryAssignment } from "../../lib/api/types";
import { formatDateTime, nextActionLabel } from "../../lib/delivery/dashboard";
import { fonts } from "../../lib/theme";

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
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, toneStyles[tone]]}>{value}</Text>
    </View>
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
    <View style={styles.sectionCard}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function AssignmentCard({
  assignment,
  style,
  ...props
}: PressableProps & {
  assignment: DeliveryAssignment;
}) {
  const customer = assignment.customer.businessName ?? assignment.customer.fullName;

  return (
    <Pressable
      {...props}
      accessibilityHint={
        props.accessibilityHint ?? "Opens delivery details and status actions"
      }
      accessibilityLabel={
        props.accessibilityLabel ??
        `${assignment.orderNumber}, ${customer}, ${assignment.status.replaceAll(
          "_",
          " "
        )}`
      }
      accessibilityRole="button"
      style={(state) => [
        styles.assignmentPressable,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style
      ]}
    >
      <View style={styles.assignmentCard}>
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
      </View>
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
      <Ionicons color="#55716E" name={icon} size={30} />
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
      <Ionicons color="#607A77" name={icon} size={16} />
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
    color: "#123432"
  },
  success: {
    color: "#0F6F68"
  },
  warning: {
    color: "#92400E"
  }
});

const styles = StyleSheet.create({
  assignmentCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBDEDB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: "100%"
  },
  assignmentPressable: {
    minHeight: 44
  },
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  customer: {
    color: "#607A77",
    fontFamily: fonts.bodySemiBold,
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
    color: "#55716E",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  emptyTitle: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  footerRow: {
    alignItems: "center",
    borderTopColor: "#CBDEDB",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 7
  },
  footerText: {
    color: "#55716E",
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "700"
  },
  infoLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  infoText: {
    color: "#2B4946",
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  loadingStack: {
    gap: 10
  },
  metricCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBDEDB",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: 145,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  metricLabel: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metricValue: {
    fontFamily: fonts.headingBold,
    fontSize: 21,
    fontWeight: "900"
  },
  nextAction: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "900"
  },
  orderNumber: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 17,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBDEDB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: "100%"
  },
  sectionTitle: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 16,
    fontWeight: "900"
  },
  titleBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0
  }
});
