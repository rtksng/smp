import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "@/components/ui/state-view";
import { getCustomerProfile } from "@/lib/api/customer";
import { listOrders } from "@/lib/api/orders";
import type { Order } from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatRupees, formatStatus } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

const accountNavigation = [
  {
    href: "/account" as const,
    icon: "grid" as const,
    label: "Overview"
  },
  {
    href: "/orders" as const,
    icon: "package" as const,
    label: "Orders"
  },
  {
    href: "/addresses" as const,
    icon: "map-pin" as const,
    label: "Addresses"
  },
  {
    href: "/cart" as const,
    icon: "shopping-cart" as const,
    label: "Cart"
  }
];

export default function AccountScreen() {
  const { isReady, session, signOut } = useAuth();
  const profileQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getCustomerProfile,
    queryKey: queryKeys.profile
  });
  const ordersQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => listOrders(1, 3),
    queryKey: [...queryKeys.orders, "overview", 3]
  });

  if (!isReady) {
    return (
      <AccountPage>
        <Screen>
          <LoadingState label="Restoring your account" />
        </Screen>
      </AccountPage>
    );
  }

  if (!session) {
    return (
      <AccountPage>
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
                borderCurve: "continuous",
                borderRadius: 14,
                height: 54,
                justifyContent: "center",
                width: 54
              }}
            >
              <Feather color={colors.primaryDark} name="shield" size={28} />
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
                fontFamily: fonts.bodySemiBold,
                lineHeight: 22,
                textAlign: "center"
              }}
            >
              Sign in with your mobile number to manage your profile, addresses,
              cart, checkout, and orders.
            </Text>
            <Button href="/login?returnTo=/account">Login / Signup</Button>
          </View>
        </Screen>
      </AccountPage>
    );
  }

  const displayName =
    profileQuery.data?.name || session.customer.firstName || "Customer";

  return (
    <AccountPage>
      <Screen gap={20}>
      <View style={{ ...cardStyle, gap: 12, padding: 16 }}>
        <View style={{ gap: 5 }}>
          <Text
            selectable
            style={{
              color: colors.primaryDark,
              fontFamily: fonts.bodySemiBold,
              fontSize: 12,
              textTransform: "uppercase"
            }}
          >
            Customer account
          </Text>
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.heading,
              fontSize: 16
            }}
          >
            {displayName}
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 12
            }}
          >
            {session.customer.mobileNumber}
          </Text>
        </View>

        <View
          accessibilityLabel="Account navigation"
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6
          }}
        >
          {accountNavigation.map((item) => (
            <AccountNavigationLink
              active={item.href === "/account"}
              href={item.href}
              icon={item.icon}
              key={item.href}
              label={item.label}
            />
          ))}
        </View>

        <Button onPress={() => void signOut()} variant="outline">
          Logout
        </Button>
      </View>

      <View
        style={{
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          gap: 8,
          paddingBottom: 16
        }}
      >
        <Text
          selectable
          style={{
            color: colors.text,
            fontFamily: fonts.heading,
            fontSize: 24,
            lineHeight: 31
          }}
        >
          Account overview
        </Text>
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: fonts.bodySemiBold,
            fontSize: 14,
            lineHeight: 24
          }}
        >
          Review recent orders and use the account navigation to manage your
          profile, addresses, cart, and order history.
        </Text>
      </View>

      {profileQuery.isError ? (
        <ErrorState
          message={getErrorMessage(
            profileQuery.error,
            "Unable to load your profile."
          )}
          onRetry={() => void profileQuery.refetch()}
          title="Unable to load profile"
        />
      ) : null}

      <View style={{ ...cardStyle, gap: 16, padding: 20 }}>
        <View
          style={{
            alignItems: "flex-start",
            flexDirection: "row",
            gap: 12,
            justifyContent: "space-between"
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              selectable
              style={{
                color: colors.text,
                fontFamily: fonts.heading,
                fontSize: 16,
                lineHeight: 22
              }}
            >
              Recent orders
            </Text>
            <Text
              selectable
              style={{
                color: colors.muted,
                fontFamily: fonts.bodySemiBold,
                fontSize: 13,
                lineHeight: 20
              }}
            >
              Latest account orders with their current status and total.
            </Text>
          </View>
          <Button
            href="/orders"
            style={{ minHeight: 36, paddingHorizontal: 12 }}
            variant="outline"
          >
            View all orders
          </Button>
        </View>

        {ordersQuery.isLoading ? (
          <LoadingState label="Loading recent orders" />
        ) : null}
        {ordersQuery.isError ? (
          <ErrorState
            message={getErrorMessage(
              ordersQuery.error,
              "Unable to load orders."
            )}
            onRetry={() => void ordersQuery.refetch()}
            title="Unable to load orders"
          />
        ) : null}
        {ordersQuery.isSuccess && ordersQuery.data.items.length === 0 ? (
          <EmptyState
            action={<Button href="/search">Browse products</Button>}
            description="Your recent orders will appear here after checkout."
            title="No orders yet"
          />
        ) : null}
        {ordersQuery.data?.items.map((order, index) => (
          <RecentOrderRow
            first={index === 0}
            key={order.id}
            order={order}
          />
        ))}
      </View>
      </Screen>
    </AccountPage>
  );
}

function AccountPage({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <StoreHeader />
      {children}
    </View>
  );
}

function AccountNavigationLink({
  active,
  href,
  icon,
  label
}: {
  active: boolean;
  href: (typeof accountNavigation)[number]["href"];
  icon: (typeof accountNavigation)[number]["icon"];
  label: string;
}) {
  return (
    <Link asChild href={href}>
      <Pressable
        accessibilityState={{ selected: active }}
        style={{
          alignItems: "center",
          backgroundColor: active ? colors.primaryDark : colors.background,
          borderColor: active ? colors.primaryDark : colors.border,
          borderCurve: "continuous",
          borderRadius: 999,
          borderWidth: 1,
          flexBasis: "48%",
          flexDirection: "row",
          flexGrow: 1,
          gap: 6,
          justifyContent: "center",
          minHeight: 36,
          paddingHorizontal: 12
        }}
      >
        <Feather
          color={active ? colors.surface : colors.text}
          name={icon}
          size={14}
        />
        <Text
          selectable
          style={{
            color: active ? colors.surface : colors.text,
            fontFamily: fonts.bodySemiBold,
            fontSize: 12
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function RecentOrderRow({
  first,
  order
}: {
  first: boolean;
  order: Order;
}) {
  return (
    <Link
      asChild
      href={{ pathname: "/orders/[id]", params: { id: order.id } }}
    >
      <Pressable
        style={{
          borderTopColor: colors.border,
          borderTopWidth: first ? 0 : 1,
          gap: 8,
          paddingTop: first ? 0 : 16
        }}
      >
        <View
          style={{
            alignItems: "flex-start",
            flexDirection: "row",
            gap: 12,
            justifyContent: "space-between"
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              selectable
              style={{
                color: colors.primaryDark,
                fontFamily: fonts.bodySemiBold,
                fontSize: 14
              }}
            >
              {order.orderNumber}
            </Text>
            <Text
              selectable
              style={{
                color: colors.muted,
                fontFamily: fonts.bodySemiBold,
                fontSize: 12
              }}
            >
              Placed {formatDate(order.placedAt ?? order.createdAt)}
            </Text>
          </View>
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.bodySemiBold,
              fontSize: 14,
              fontVariant: ["tabular-nums"]
            }}
          >
            {formatRupees(order.totals.grandTotal)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatusBadge label={formatStatus(order.status)} success />
          <StatusBadge
            label={
              order.paymentStatus === "PENDING"
                ? "Payment pending"
                : formatStatus(order.paymentStatus)
            }
          />
        </View>
      </Pressable>
    </Link>
  );
}

function StatusBadge({
  label,
  success = false
}: {
  label: string;
  success?: boolean;
}) {
  return (
    <Text
      selectable
      style={{
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
