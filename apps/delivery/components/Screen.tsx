import type { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  footer?: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}>;

export function Screen({ children, footer, scroll = true, style }: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, styles.scrollContent, style]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, style]}>{children}</View>
  );

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "stretch",
    gap: 10,
    paddingBottom: 20,
    paddingHorizontal: 10,
    paddingTop: 8,
    width: "100%"
  },
  fill: {
    flex: 1
  },
  footer: {
    borderTopColor: "#E2E8F0",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  safeArea: {
    backgroundColor: "#F8FAFC",
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  }
});
