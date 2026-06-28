import { Ionicons } from "@expo/vector-icons";
import {
  StyleSheet,
  Text,
  type PressableProps
} from "react-native";
import { Button } from "heroui-native/button";
import { Spinner } from "heroui-native/spinner";

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
  const variant =
    tone === "danger" ? "danger" : tone === "secondary" ? "outline" : "primary";
  const foreground = tone === "secondary" ? "#0F172A" : "#FFFFFF";
  const toneStyle =
    tone === "danger"
      ? styles.dangerButton
      : tone === "secondary"
        ? styles.secondaryButton
        : styles.primaryButton;

  return (
    <Button
      accessibilityRole="button"
      isDisabled={disabled || loading}
      onPress={props.onPress}
      style={[
        styles.button,
        toneStyle,
        (disabled || loading) && styles.disabled,
        typeof style === "function" ? undefined : style
      ]}
      variant={variant}
      {...props}
    >
      {loading ? (
        <Spinner color={foreground} size="sm" />
      ) : icon ? (
        <Ionicons
          color={foreground}
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
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 14
  },
  disabled: {
    opacity: 0.55
  },
  dangerButton: {
    backgroundColor: "#B91C1C",
    borderColor: "#B91C1C"
  },
  label: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800"
  },
  primaryButton: {
    backgroundColor: "#287C30",
    borderColor: "#287C30"
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1"
  },
  secondaryLabel: {
    color: "#0F172A"
  }
});
