import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { getCustomerProfile } from "@/lib/api/customer";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function AccountScreen() {
  const { isReady, session, signOut } = useAuth();
  const profileQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getCustomerProfile,
    queryKey: queryKeys.profile
  });

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
            ...cardStyle,
            alignItems: "center",
            gap: 14,
            padding: 28
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.primarySoft,
              borderRadius: 14,
              height: 54,
              justifyContent: "center",
              width: 54
            }}
          >
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="shield-check"
              size={28}
            />
          </View>
          <Text
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.heading,
              fontSize: 22,
              textAlign: "center"
            }}
          >
            Your surgical supply account
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              lineHeight: 22,
              textAlign: "center"
            }}
          >
            Sign in with your mobile number to manage addresses, cart, checkout,
            and orders.
          </Text>
          <Button href="/login?returnTo=/account">Login / Signup</Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ ...cardStyle, gap: 12, padding: 18 }}>
        <Text
          selectable
          style={{
            color: colors.gold,
            fontFamily: fonts.bodySemiBold,
            fontSize: 11,
            textTransform: "uppercase"
          }}
        >
          Customer account
        </Text>
        <Text
          selectable
          style={{
            color: colors.ink,
            fontFamily: fonts.headingBold,
            fontSize: 23
          }}
        >
          {profileQuery.data?.name || session.customer.firstName}
        </Text>
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: fonts.bodySemiBold,
            fontSize: 13
          }}
        >
          {session.customer.mobileNumber}
        </Text>
      </View>

      {profileQuery.isLoading ? <LoadingState label="Loading profile" /> : null}
      {profileQuery.isError ? (
        <ErrorState
          message={getErrorMessage(profileQuery.error, "Unable to load profile.")}
          onRetry={() => void profileQuery.refetch()}
        />
      ) : null}

      <View style={{ gap: 10 }}>
        <AccountLink
          href="/orders"
          icon="package-variant-closed"
          label="Your orders"
          subtitle="Track, reorder, cancel, or request a return"
        />
        <AccountLink
          href="/addresses"
          icon="map-marker-outline"
          label="Saved addresses"
          subtitle="Manage clinic, hospital, home, and work addresses"
        />
        <AccountLink
          href="/cart"
          icon="cart-outline"
          label="Your cart"
          subtitle="Review quantities and continue to checkout"
        />
      </View>
      <Button onPress={() => void signOut()} variant="outline">
        Sign out
      </Button>
    </Screen>
  );
}

function AccountLink({
  href,
  icon,
  label,
  subtitle
}: {
  href: "/addresses" | "/cart" | "/orders";
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  subtitle: string;
}) {
  return (
    <Link asChild href={href}>
      <Pressable
        style={({ pressed }) => ({
          ...cardStyle,
          alignItems: "center",
          flexDirection: "row",
          gap: 13,
          opacity: pressed ? 0.84 : 1,
          padding: 15
        })}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.primarySoft,
            borderRadius: 11,
            height: 44,
            justifyContent: "center",
            width: 44
          }}
        >
          <MaterialCommunityIcons
            color={colors.primaryDark}
            name={icon}
            size={22}
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.heading,
              fontSize: 15
            }}
          >
            {label}
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 11,
              lineHeight: 17
            }}
          >
            {subtitle}
          </Text>
        </View>
        <MaterialCommunityIcons
          color={colors.primaryDark}
          name="chevron-right"
          size={22}
        />
      </Pressable>
    </Link>
  );
}
