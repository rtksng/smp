import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from "react-native";

type ActionButtonProps = PressableProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  loading?: boolean;
  tone?: "primary" | "secondary" | "danger";
};

export function ActionButton({
  disabled,
  icon,
  label,
  loading,
  style,
  tone = "primary",
  ...props
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.button,
        styles[tone],
        (disabled || loading) && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={tone === "secondary" ? "#0F172A" : "#FFFFFF"} />
      ) : icon ? (
        <Ionicons
          color={tone === "secondary" ? "#0F172A" : "#FFFFFF"}
          name={icon}
          size={19}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.label, tone === "secondary" && styles.secondaryLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14
  },
  danger: {
    backgroundColor: "#B91C1C"
  },
  disabled: {
    opacity: 0.55
  },
  label: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.82
  },
  primary: {
    backgroundColor: "#287c30"
  },
  secondary: {
    backgroundColor: "#E2E8F0"
  },
  secondaryLabel: {
    color: "#0F172A"
  }
});
