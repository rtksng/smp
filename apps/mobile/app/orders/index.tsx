import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { AccountInfoGrid, AccountPageHeader, AccountSection, AccountSectionHeader, AccountStatusBadge } from "@/components/account-layout";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "@/components/ui/state-view";
import { listOrders } from "@/lib/api/orders";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatRupees, formatStatus } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function OrdersScreen() {
  const { isReady, session } = useAuth();
  const query = useQuery({
    enabled: Boolean(session),
    queryFn: () => listOrders(1, 50),
    queryKey: queryKeys.orders
  });

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login?returnTo=/orders");
    }
  }, [isReady, session]);

  if (isReady && !session) {
    return null;
  }

  if (!isReady || query.isLoading) {
    return (
      <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
        <AccountPageHeader description="Track order status, payment status, totals, and invoices." title="Orders" />
        <LoadingState label="Loading your orders" />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
        <AccountPageHeader description="Track order status, payment status, totals, and invoices." title="Orders" />
        <ErrorState
          message={getErrorMessage(query.error, "Unable to load orders.")}
          onRetry={() => void query.refetch()}
          title="Unable to load orders"
        />
      </Screen>
    );
  }

  const orders = query.data?.items ?? [];
  const latestOrder = orders[0];

  return (
    <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
      <AccountPageHeader description="Track order status, payment status, totals, and invoices." title="Orders" />
      <AccountInfoGrid items={[
        { label: "Total orders", value: String(query.data?.pagination.total ?? 0) },
        { label: "Latest", value: latestOrder ? formatDate(latestOrder.placedAt ?? latestOrder.createdAt) : "-" },
        { label: "Latest status", value: latestOrder ? formatStatus(latestOrder.status) : "-" },
        { label: "Latest total", value: latestOrder ? formatRupees(latestOrder.totals.grandTotal) : "-" }
      ]} />
      {orders.length === 0 ? (
        <EmptyState action={<Button href="/search">Shop products</Button>} description="Your customer orders will appear here after checkout." title="No orders yet" />
      ) : (
      <AccountSection>
        <AccountSectionHeader description="Review each order, status, payment state, and invoice availability." title="Order history" />
      {orders.map((order) => (
        <View key={order.id} style={{ ...cardStyle, backgroundColor: colors.background, borderRadius: 8, gap: 12, padding: 16 }}>
          <View
            style={{
              alignItems: "flex-start",
              flexDirection: "row",
              gap: 10,
              justifyContent: "space-between"
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                numberOfLines={1}
                selectable
                style={{
                  color: colors.primaryDark,
                  flexShrink: 1,
                  fontFamily: fonts.heading,
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
                  fontSize: 11
                }}
              >
                {formatDate(order.placedAt ?? order.createdAt)}
              </Text>
            </View>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={1}
              selectable
              style={{
                color: colors.ink,
                fontFamily: fonts.headingBold,
                fontSize: 14,
                fontVariant: ["tabular-nums"],
                textAlign: "right"
              }}
            >
              {formatRupees(order.totals.grandTotal)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <AccountStatusBadge label={formatStatus(order.status)} success={order.status === "DELIVERED"} />
            <AccountStatusBadge label={formatStatus(order.paymentStatus)} />
          </View>
          <Button
            href={{ pathname: "/orders/[id]", params: { id: order.id } }}
            variant="outline"
          >
            View details
          </Button>
        </View>
      ))}
      </AccountSection>
      )}
    </Screen>
  );
}
