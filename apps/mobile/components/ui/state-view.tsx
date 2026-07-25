import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
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
  message,
  onRetry,
  title = "Something went wrong"
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{ ...cardStyle, alignItems: "center", gap: 12, padding: 24 }}
    >
      <MaterialCommunityIcons
        color={colors.danger}
        name="alert-circle-outline"
        size={34}
      />
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
          lineHeight: 21,
          textAlign: "center"
        }}
      >
        {message}
      </Text>
      {onRetry ? (
        <Button onPress={onRetry} variant="outline">
          Try again
        </Button>
      ) : null}
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
    <View style={{ ...cardStyle, alignItems: "center", gap: 12, padding: 24 }}>
      <MaterialCommunityIcons
        color={colors.primaryDark}
        name="package-variant"
        size={38}
      />
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
          lineHeight: 21,
          textAlign: "center"
        }}
      >
        {description}
      </Text>
      {action}
    </View>
  );
}
