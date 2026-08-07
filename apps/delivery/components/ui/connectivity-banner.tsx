import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts } from "../../lib/theme";

export function ConnectivityBanner({
  actionLabel,
  message,
  onAction,
  tone = "warning"
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  tone?: "danger" | "warning";
}) {
  const danger = tone === "danger";

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.banner, danger && styles.dangerBanner]}
    >
      <Ionicons
        color={danger ? "#991B1B" : "#92400E"}
        name={danger ? "alert-circle-outline" : "cloud-offline-outline"}
        size={20}
      />
      <Text style={[styles.message, danger && styles.dangerMessage]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={4}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed
          ]}
        >
          <Text style={[styles.actionText, danger && styles.dangerActionText]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8
  },
  actionPressed: {
    opacity: 0.7
  },
  actionText: {
    color: "#92400E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "900"
  },
  banner: {
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  dangerActionText: {
    color: "#991B1B"
  },
  dangerBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5"
  },
  dangerMessage: {
    color: "#991B1B"
  },
  message: {
    color: "#92400E",
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  }
});
