import { StyleSheet, Text } from "react-native";
import { Chip } from "heroui-native/chip";
import type { DeliveryStatus } from "../lib/api/types";
import { statusLabel } from "../lib/api/status";
import { fonts } from "../lib/theme";

type StatusPillProps = {
  status: DeliveryStatus | string;
};

export function StatusPill({ status }: StatusPillProps) {
  const tone = statusTone(status);
  const color =
    tone === "success"
      ? "success"
      : tone === "danger"
        ? "danger"
        : tone === "warning"
          ? "warning"
          : "default";

  return (
    <Chip color={color} size="sm" variant="soft">
      <Text style={[styles.label, styles[`${tone}Label`]]}>
        {statusLabel(status as DeliveryStatus)}
      </Text>
    </Chip>
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
  dangerLabel: {
    color: "#991B1B"
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "800"
  },
  neutralLabel: {
    color: "#2B4946"
  },
  successLabel: {
    color: "#0F6F68"
  },
  warningLabel: {
    color: "#92400E"
  }
});
