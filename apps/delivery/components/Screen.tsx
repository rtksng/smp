import type { PropsWithChildren, ReactNode } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  SafeAreaView,
  type Edge
} from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  edges?: Edge[];
  footer?: ReactNode;
  keyboardBottomOffset?: number;
  scroll?: boolean;
  style?: ViewStyle;
}>;

export function Screen({
  children,
  edges = ["top", "bottom", "left", "right"],
  footer,
  keyboardBottomOffset = 96,
  scroll = true,
  style
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 16 : 6;
  const body = scroll ? (
    <KeyboardAwareScrollView
      bottomOffset={keyboardBottomOffset}
      contentContainerStyle={[
        styles.content,
        styles.scrollContent,
        { paddingHorizontal: horizontalPadding },
        style
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode={
        process.env.EXPO_OS === "ios" ? "interactive" : "on-drag"
      }
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View
      style={[
        styles.content,
        styles.fill,
        { paddingHorizontal: horizontalPadding },
        style
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "stretch",
    alignSelf: "center",
    gap: 8,
    maxWidth: 920,
    paddingBottom: 16,
    paddingTop: 6,
    width: "100%"
  },
  fill: {
    flex: 1
  },
  footer: {
    alignSelf: "center",
    borderTopColor: "#E2E8F0",
    borderTopWidth: StyleSheet.hairlineWidth,
    maxWidth: 920,
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: "100%"
  },
  safeArea: {
    backgroundColor: "#F8FAFC",
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  }
});
