import { StyleSheet, Text, View } from "react-native";
import type { DeliveryStatus } from "../lib/api/types";
import { statusLabel } from "../lib/api/status";

type StatusPillProps = {
  status: DeliveryStatus | string;
};

export function StatusPill({ status }: StatusPillProps) {
  const tone = statusTone(status);

  return (
    <View style={[styles.pill, styles[tone]]}>
      <Text style={[styles.label, styles[`${tone}Label`]]}>
        {statusLabel(status as DeliveryStatus)}
      </Text>
    </View>
  );
}

function statusTone(status: string) {
  if (status === "DELIVERED" || status === "ACTIVE") {
    return "success";
  }

  if (status === "FAILED" || status === "CANCELLED" || status === "SUSPENDED") {
    return "danger";
  }

  if (status === "OUT_FOR_DELIVERY" || status === "PICKED_UP") {
    return "warning";
  }

  return "neutral";
}

const styles = StyleSheet.create({
  danger: {
    backgroundColor: "#FEE2E2"
  },
  dangerLabel: {
    color: "#991B1B"
  },
  label: {
    fontSize: 12,
    fontWeight: "800"
  },
  neutral: {
    backgroundColor: "#E2E8F0"
  },
  neutralLabel: {
    color: "#334155"
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  success: {
    backgroundColor: "#DCFCE7"
  },
  successLabel: {
    color: "#166534"
  },
  warning: {
    backgroundColor: "#FEF3C7"
  },
  warningLabel: {
    color: "#92400E"
  }
});
