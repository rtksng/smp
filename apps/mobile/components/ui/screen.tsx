import type { PropsWithChildren } from "react";
import { View, useWindowDimensions, type ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { colors } from "@/lib/theme";
import { StoreFooter } from "@/components/store-footer";

type ScreenProps = PropsWithChildren<
  ScrollViewProps & {
    gap?: number;
    keyboardBottomOffset?: number;
  }
>;

export function Screen({
  children,
  gap = 16,
  keyboardBottomOffset = 96,
  ...props
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 24 : 16;
  const {
    contentContainerStyle,
    keyboardDismissMode,
    keyboardShouldPersistTaps,
    style,
    ...scrollProps
  } = props;

  return (
    <KeyboardAwareScrollView
      bottomOffset={keyboardBottomOffset}
      contentContainerStyle={[
        {
          alignSelf: "center",
          flexGrow: 1,
          gap,
          maxWidth: 980,
          paddingBottom: 0,
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          width: "100%"
        },
        contentContainerStyle
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode={
        keyboardDismissMode ??
        (process.env.EXPO_OS === "ios" ? "interactive" : "on-drag")
      }
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? "handled"}
      style={[{ backgroundColor: colors.background, flex: 1 }, style]}
      {...scrollProps}
    >
      {children}
      <View style={{ marginHorizontal: -horizontalPadding, marginTop: 32 }}>
        <StoreFooter />
      </View>
    </KeyboardAwareScrollView>
  );
}

export function PageSurface({ children }: PropsWithChildren) {
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>{children}</View>
  );
}
