import { Feather } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { LoadingState } from "@/components/ui/state-view";
import { useAuth } from "@/lib/auth/auth-context";
import { colors, fonts } from "@/lib/theme";

const accountLinks = [
  { href: "/account/profile" as const, icon: "user" as const, label: "Profile" },
  { href: "/orders" as const, icon: "package" as const, label: "Orders" },
  { href: "/account/wishlist" as const, icon: "heart" as const, label: "Wishlist" },
  { href: "/addresses" as const, icon: "map-pin" as const, label: "Addresses" },
  { href: "/account/quotes" as const, icon: "file-text" as const, label: "Quotes" }
];

export default function AccountScreen() {
  const { isReady, session, signOut } = useAuth();

  if (!isReady) {
    return (
      <Screen>
        <LoadingState label="Restoring your account" />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 8,
            borderWidth: 1,
            gap: 12,
            padding: 24
          }}
        >
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.heading,
              fontSize: 18,
              textAlign: "center"
            }}
          >
            Sign in to open your account
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 14,
              lineHeight: 22,
              textAlign: "center"
            }}
          >
            Manage your profile, orders, wishlist, saved addresses, and quotes.
          </Text>
          <Button href="/login?returnTo=/account">Login / Signup</Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: 24 }}>
      <View
        accessibilityLabel="Account menu"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 8,
          borderWidth: 1,
          gap: 8,
          padding: 12
        }}
      >
        {accountLinks.map((link) => (
          <Pressable
            accessibilityLabel={link.label}
            accessibilityRole="button"
            key={link.href}
            onPress={() => router.push(link.href as Href)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: 8,
              borderWidth: 1,
              flexDirection: "row",
              gap: 12,
              minHeight: 48,
              opacity: pressed ? 0.76 : 1,
              paddingHorizontal: 16
            })}
          >
            <Feather color={colors.text} name={link.icon} size={16} />
            <Text
              style={{
                color: colors.text,
                flex: 1,
                fontFamily: fonts.bodySemiBold,
                fontSize: 14
              }}
            >
              {link.label}
            </Text>
            <Feather color="#7A8D7C" name="chevron-right" size={17} />
          </Pressable>
        ))}
        <Button
          onPress={async () => {
            await signOut();
            router.replace("/");
          }}
          style={{ justifyContent: "flex-start", marginTop: 4 }}
          variant="outline"
        >
          Logout
        </Button>
      </View>
    </Screen>
  );
}
