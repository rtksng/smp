import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Toast, useToast } from "heroui-native/toast";
import { ApiError } from "../../lib/api/client";

type ToastTone = "success" | "danger" | "warning" | "accent" | "default";

export function useAppFeedback() {
  const { toast } = useToast();

  return {
    error(message: string, label = "Request failed") {
      showFeedbackToast(toast, "danger", label, message);
    },
    info(message: string, label = "Update") {
      showFeedbackToast(toast, "accent", label, message);
    },
    success(message: string, label = "Success") {
      showFeedbackToast(toast, "success", label, message);
    },
    toast(label: string, description: string, variant: ToastTone = "default") {
      showFeedbackToast(toast, variant, label, description);
    },
    warning(message: string, label = "Check details") {
      showFeedbackToast(toast, "warning", label, message);
    }
  };
}

function showFeedbackToast(
  toast: ReturnType<typeof useToast>["toast"],
  variant: ToastTone,
  label: string,
  description: string
) {
  const tone = toastTones[variant];

  toast.show({
    duration: variant === "danger" ? 5000 : 3600,
    component: (props) => (
      <Toast
        {...props}
        accessibilityLiveRegion="polite"
        className="flex-row"
        placement="top"
        style={[styles.toastRoot, { borderLeftColor: tone.border }]}
        variant="default"
      >
        <View style={[styles.toastIcon, { backgroundColor: tone.soft }]}>
          <Ionicons color={tone.iconColor} name={tone.icon} size={18} />
        </View>
        <View style={styles.toastContent}>
          <Text numberOfLines={1} style={styles.toastLabel}>
            {label}
          </Text>
          <Text numberOfLines={3} style={styles.toastDescription}>
            {description}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss message"
          accessibilityRole="button"
          onPress={() => props.hide(props.id)}
          style={styles.toastClose}
        >
          <Ionicons color="#64748B" name="close" size={16} />
        </Pressable>
      </Toast>
    )
  });
}

export function confirmAction(input: {
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  title: string;
}) {
  Alert.alert(input.title, input.body, [
    {
      style: "cancel",
      text: "Cancel"
    },
    {
      onPress: input.onConfirm,
      style:
        input.destructive || input.confirmLabel === "Fail"
          ? "destructive"
          : "default",
      text: input.confirmLabel ?? "Confirm"
    }
  ]);
}

export function errorMessage(error: unknown) {
  const status = error instanceof ApiError ? error.status : undefined;
  const message =
    error instanceof ApiError
      ? extractMessage(error.details) ?? error.message
      : error instanceof Error
        ? error.message
        : undefined;

  return toUserMessage(message, status);
}

function extractMessage(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractMessage).filter(Boolean).join(" ");
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return (
      extractMessage(record.message) ??
      extractMessage(record.error) ??
      extractMessage(record.details)
    );
  }

  return undefined;
}

function toUserMessage(message?: string, status?: number) {
  const fallback =
    status && status >= 500
      ? "Something went wrong on the server. Try again in a few minutes."
      : status === 401 || status === 403
        ? "Your session has expired. Sign in again."
        : "Please check the details and try again.";

  if (!message) {
    return fallback;
  }

  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("load failed")
  ) {
    return "Unable to connect to the server. Check your internet and try again.";
  }

  if (lower.includes("mobilenumber") || lower.includes("mobile number")) {
    if (
      lower.includes("must match") ||
      lower.includes("regular expression") ||
      lower.includes("valid")
    ) {
      return "Enter a valid 10 digit Indian mobile number.";
    }
  }

  if (lower.includes("otp")) {
    if (lower.includes("must match") || lower.includes("regular expression")) {
      return "Enter the 6 digit OTP sent to your mobile.";
    }

    if (lower.includes("invalid") || lower.includes("expired")) {
      return "The OTP is incorrect or expired. Request a new OTP and try again.";
    }
  }

  if (lower.includes("refresh token") || lower.includes("access token")) {
    return "Your session has expired. Sign in again.";
  }

  if (lower.includes("delivery partner is not active")) {
    return "Your delivery account is not active yet. Contact admin before signing in.";
  }

  if (lower.includes("delivery partner is already registered")) {
    return "This mobile number is already registered. Use OTP login after admin approval.";
  }

  if (status === 404) {
    return "We could not find this delivery. Pull to refresh and try again.";
  }

  if (status === 409) {
    return "This delivery was already updated. Pull to refresh and try again.";
  }

  if (
    lower.includes("must match") ||
    lower.includes("regular expression") ||
    lower.includes("validation failed") ||
    lower.includes("bad request")
  ) {
    return fallback;
  }

  return normalized;
}

const toastTones = {
  accent: {
    border: "#287C30",
    icon: "information-circle-outline",
    iconColor: "#166534",
    soft: "#E8F5EC"
  },
  danger: {
    border: "#B91C1C",
    icon: "alert-circle-outline",
    iconColor: "#991B1B",
    soft: "#FEE2E2"
  },
  default: {
    border: "#64748B",
    icon: "notifications-outline",
    iconColor: "#475569",
    soft: "#F1F5F9"
  },
  success: {
    border: "#287C30",
    icon: "checkmark-circle-outline",
    iconColor: "#166534",
    soft: "#E8F5EC"
  },
  warning: {
    border: "#D97706",
    icon: "warning-outline",
    iconColor: "#92400E",
    soft: "#FEF3C7"
  }
} satisfies Record<
  ToastTone,
  {
    border: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    soft: string;
  }
>;

const styles = StyleSheet.create({
  toastClose: {
    alignItems: "center",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  toastContent: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  toastDescription: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  toastIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  toastLabel: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "900"
  },
  toastRoot: {
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
    borderLeftWidth: 4,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  }
});
