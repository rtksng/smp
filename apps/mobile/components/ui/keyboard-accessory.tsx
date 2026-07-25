import { InputAccessoryView, Keyboard, Pressable, Text, View } from "react-native";
import { colors, fonts } from "@/lib/theme";

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
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          flexDirection: "row",
          justifyContent: "flex-end",
          minHeight: 48,
          paddingHorizontal: 12
        }}
      >
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
          style={({ pressed }) => ({
            alignItems: "center",
            borderRadius: 999,
            justifyContent: "center",
            minHeight: 44,
            minWidth: 64,
            opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
            paddingHorizontal: 12
          })}
        >
          <Text
            style={{
              color: colors.primaryDark,
              fontFamily: fonts.bodySemiBold,
              fontSize: 15
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
