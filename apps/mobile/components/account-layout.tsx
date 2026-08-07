import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { colors, fonts } from "@/lib/theme";

export function AccountPageHeader({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <View style={{ borderBottomColor: colors.border, borderBottomWidth: 1, gap: 8, paddingBottom: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
        <View accessibilityLabel="Account breadcrumb" style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 }}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/account")}>
            <Text style={{ color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>
              Account
            </Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>/</Text>
          <Text numberOfLines={1} style={{ color: colors.text, flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{title}</Text>
        </View>
        <Pressable
          accessibilityLabel="Back to account"
          accessibilityRole="button"
          onPress={() => router.push("/account")}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: "row",
            flexShrink: 0,
            gap: 6,
            minHeight: 32,
            opacity: pressed ? 0.75 : 1,
            paddingHorizontal: 12
          })}
        >
          <Feather color={colors.text} name="arrow-left" size={14} />
          <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Back</Text>
        </Pressable>
      </View>
      <Text selectable style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 24, lineHeight: 31 }}>
        {title}
      </Text>
      <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 24 }}>
        {description}
      </Text>
    </View>
  );
}

export function AccountInfoGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 8,
            borderWidth: 1,
            flexBasis: "47%",
            flexGrow: 1,
            gap: 8,
            padding: 16
          }}
        >
          <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12, textTransform: "uppercase" }}>
            {item.label}
          </Text>
          <Text numberOfLines={2} selectable style={{ color: colors.text, flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function AccountSection({ children }: PropsWithChildren) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 16, padding: 20 }}>
      {children}
    </View>
  );
}

export function AccountSectionHeader({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
        <Text numberOfLines={2} selectable style={{ color: colors.text, flex: 1, flexShrink: 1, fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 }}>
          {title}
        </Text>
        {action}
      </View>
      {description ? (
        <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function AccountStatusBadge({
  label,
  success = false
}: {
  label: string;
  success?: boolean;
}) {
  return (
    <Text
      numberOfLines={1}
      selectable
      style={{
        alignSelf: "flex-start",
        backgroundColor: success ? "#EDF7F4" : colors.primarySoft,
        borderRadius: 999,
        color: success ? "#0F6B50" : colors.text,
        fontFamily: fonts.bodySemiBold,
        fontSize: 12,
        minHeight: 28,
        paddingHorizontal: 10,
        paddingVertical: 6
      }}
    >
      {label}
    </Text>
  );
}
