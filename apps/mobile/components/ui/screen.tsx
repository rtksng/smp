import type { PropsWithChildren } from "react";
import {
  ScrollView,
  View,
  useWindowDimensions,
  type ScrollViewProps
} from "react-native";
import { colors } from "@/lib/theme";

type ScreenProps = PropsWithChildren<
  ScrollViewProps & {
    gap?: number;
  }
>;

export function Screen({ children, gap = 16, ...props }: ScreenProps) {
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
    <ScrollView
      automaticallyAdjustKeyboardInsets={process.env.EXPO_OS === "ios"}
      contentContainerStyle={[
        {
          alignSelf: "center",
          flexGrow: 1,
          gap,
          maxWidth: 980,
          paddingBottom: 40,
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
    </ScrollView>
  );
}

export function PageSurface({ children }: PropsWithChildren) {
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>{children}</View>
  );
}
