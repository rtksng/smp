import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View, useWindowDimensions } from "react-native";
import { colors, fonts, cardStyle } from "@/lib/theme";
import { Button } from "./button";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      style={{
        ...cardStyle,
        alignItems: "center",
        gap: 12,
        justifyContent: "center",
        minHeight: 180,
        padding: 24
      }}
    >
      <ActivityIndicator color={colors.primaryDark} size="large" />
      <Text
        selectable
        style={{ color: colors.muted, fontFamily: fonts.bodySemiBold }}
      >
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({
  action,
  message,
  onRetry,
  title = "Something went wrong"
}: {
  action?: ReactNode;
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  const { width } = useWindowDimensions();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.dangerBackground,
        borderColor: "#F4C7C3",
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: width >= 640 ? "row" : "column",
        gap: 16,
        padding: 20
      }}
    >
      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 8, height: 40, justifyContent: "center", width: 40 }}>
        <MaterialCommunityIcons color={colors.danger} name="alert-outline" size={20} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text selectable style={{ color: "#7A271A", fontFamily: fonts.heading, fontSize: 18 }}>{title}</Text>
        <Text selectable style={{ color: "#7A271A", fontFamily: fonts.bodySemiBold, lineHeight: 24 }}>{message}</Text>
        {action ? action : onRetry ? <Button onPress={onRetry} style={{ alignSelf: "flex-start" }} variant="outline">Try again</Button> : null}
      </View>
    </View>
  );
}

export function EmptyState({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderStyle: "dashed", borderWidth: 1, gap: 8, justifyContent: "center", minHeight: 192, padding: 32 }}>
      <Text
        selectable
        style={{
          color: colors.ink,
          fontFamily: fonts.heading,
          fontSize: 18,
          textAlign: "center"
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{
          color: colors.muted,
          fontFamily: fonts.body,
          lineHeight: 24,
          textAlign: "center"
        }}
      >
        {description}
      </Text>
      {action ? <View style={{ paddingTop: 12 }}>{action}</View> : null}
    </View>
  );
}
