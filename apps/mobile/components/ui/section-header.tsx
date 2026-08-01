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
        selectable
        style={{
          color: colors.ink,
          flex: 1,
          fontFamily: fonts.headingBold,
          fontSize: 18
        }}
      >
        {title}
      </Text>
      {actionHref && actionText ? (
        <Link asChild href={actionHref}>
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderColor: "#C7EACB",
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
              selectable
              style={{
                color: colors.primaryDark,
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
