import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { colors, fonts } from "@/lib/theme";

export function SectionHeader({
  actionHref,
  actionText,
  title
}: {
  actionHref?: Href;
  actionText?: string;
  title: string;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between"
      }}
    >
      <Text
        numberOfLines={2}
        selectable
        style={{
          color: colors.text,
          flex: 1,
          flexShrink: 1,
          fontFamily: fonts.heading,
          fontSize: 18,
          lineHeight: 24
        }}
      >
        {title}
      </Text>
      {actionHref && actionText ? (
        <Link asChild href={actionHref}>
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderColor: "#B8E3DE",
              borderRadius: 999,
              borderWidth: 1,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 32,
              paddingHorizontal: 12,
              paddingVertical: 6
            }}
          >
            <Text
              numberOfLines={1}
              selectable
              style={{
                color: colors.primaryDark,
                flexShrink: 0,
                fontFamily: fonts.bodySemiBold,
                fontSize: 11
              }}
            >
              {actionText}
            </Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}
