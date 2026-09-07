import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, router, useGlobalSearchParams, usePathname } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCart } from "@/lib/api/cart";
import { useAuth } from "@/lib/auth/auth-context";
import { colors, fonts } from "@/lib/theme";
import { queryKeys } from "@/lib/query";

export function StoreHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const returnParams = Object.entries(searchParams)
    .filter(
      ([key, value]) => key !== "id" && key !== "slug" && typeof value === "string"
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`
    )
    .join("&");
  const returnTo = pathname + (returnParams ? `?${returnParams}` : "");
  const [search, setSearch] = useState("");
  const { session } = useAuth();
  const cartQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => getCart(),
    queryKey: queryKeys.cart()
  });
  const cartCount = cartQuery.data?.itemCount ?? 0;

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.98)",
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        gap: 12,
        paddingBottom: 8,
        paddingHorizontal: 16,
        paddingTop: insets.top + 8
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 8,
          justifyContent: "space-between"
        }}
      >
        <Link asChild href="/">
          <Pressable
            accessibilityLabel="Surgical Medical Equipment home"
            style={{
              alignItems: "center",
              flex: 1,
              flexDirection: "row",
              gap: 8,
              minHeight: 32
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.primaryDark,
                borderRadius: 8,
                height: 32,
                justifyContent: "center",
                width: 32
              }}
            >
              <MaterialCommunityIcons color="white" name="shield-check" size={17} />
            </View>
            <Text
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{
                color: colors.text,
                flex: 1,
                fontFamily: fonts.headingBold,
                fontSize: 14,
                lineHeight: 18,
                textTransform: "uppercase"
              }}
            >
              Surgical Medical Equipment
            </Text>
          </Pressable>
        </Link>
        <Link asChild href="/search">
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Delivery at checkout"
            style={{
              alignItems: "center",
              backgroundColor: colors.background,
              borderRadius: 999,
              flexDirection: "row",
              gap: 4,
              minHeight: 32,
              paddingHorizontal: 10
            }}
          >
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="map-marker-outline"
              size={14}
            />
            <Text
              selectable
              style={{
                color: colors.text,
                fontFamily: fonts.bodySemiBold,
                fontSize: 10
              }}
            >
              Delivery at checkout
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.primaryDark,
            borderRadius: 999,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            minHeight: 44,
            paddingHorizontal: 14
          }}
        >
          <TextInput
            accessibilityLabel="Search products, SKU, or brand"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            onSubmitEditing={() =>
              router.push({ pathname: "/search", params: { q: search.trim() } })
            }
            placeholder="Search products or SKU"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={{
              color: colors.text,
              flex: 1,
              fontFamily: fonts.bodySemiBold,
              fontSize: 14
            }}
            value={search}
          />
          <Pressable
            accessibilityLabel="Search catalog"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() =>
              router.push({ pathname: "/search", params: { q: search.trim() } })
            }
          >
            <MaterialCommunityIcons color={colors.text} name="magnify" size={20} />
          </Pressable>
        </View>
        <Link
          asChild
          href={session ? "/account" : { pathname: "/login", params: { returnTo } }}
        >
          <Pressable
            accessibilityLabel={session ? "Open account" : "Login or signup"}
            hitSlop={6}
            style={{
              alignItems: "center",
              height: 44,
              justifyContent: "center",
              width: 32
            }}
          >
            <MaterialCommunityIcons
              color={colors.ink}
              name="account-outline"
              size={20}
            />
          </Pressable>
        </Link>
        <Link asChild href="/cart">
          <Pressable
            accessibilityLabel="Open cart"
            hitSlop={6}
            style={{
              alignItems: "center",
              height: 44,
              justifyContent: "center",
              position: "relative",
              width: 32
            }}
          >
            <MaterialCommunityIcons color={colors.ink} name="cart-outline" size={20} />
            {cartCount > 0 ? (
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: colors.primaryDark,
                  borderRadius: 8,
                  justifyContent: "center",
                  minHeight: 16,
                  minWidth: 16,
                  paddingHorizontal: 3,
                  position: "absolute",
                  right: -2,
                  top: 2
                }}
              >
                <Text
                  selectable
                  style={{
                    color: "white",
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 9,
                    fontVariant: ["tabular-nums"]
                  }}
                >
                  {cartCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
