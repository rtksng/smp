import {
  InputAccessoryView,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

export function KeyboardAccessory({
  actionLabel = "Done",
  disabled = false,
  dismissKeyboard = true,
  nativeID,
  onPress
}: {
  actionLabel?: string;
  disabled?: boolean;
  dismissKeyboard?: boolean;
  nativeID: string;
  onPress?: () => void;
}) {
  if (process.env.EXPO_OS !== "ios") {
    return null;
  }

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            if (dismissKeyboard) {
              Keyboard.dismiss();
            }
            onPress?.();
          }}
          style={({ pressed }) => [
            styles.action,
            disabled && styles.disabled,
            pressed && !disabled && styles.pressed
          ]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12
  },
  actionText: {
    color: "#166534",
    fontSize: 15,
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.7
  },
  toolbar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopColor: "#CBD5E1",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "flex-end",
    minHeight: 48,
    paddingHorizontal: 12
  }
});
