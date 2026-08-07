import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { AccountPageHeader } from "@/components/account-layout";
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

  if (!query.data?.items.length) {
    return (
      <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
        <AccountPageHeader description="Track order status, payment status, totals, and invoices." title="Orders" />
        <EmptyState
          action={<Button href="/search">Browse products</Button>}
          description="Placed orders and delivery progress will appear here."
          title="No orders yet"
        />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
      <AccountPageHeader description="Track order status, payment status, totals, and invoices." title="Orders" />
      {query.data.items.map((order) => (
        <View key={order.id} style={{ ...cardStyle, borderRadius: 8, gap: 12, padding: 16 }}>
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
                {formatDate(order.createdAt)} · {order.items.length} items
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
            <StatusBadge label={formatStatus(order.status)} />
            <StatusBadge
              label={`${formatStatus(order.paymentStatus)} · ${
                order.paymentMethod ?? "Payment"
              }`}
              payment
            />
          </View>
          <Button
            href={{ pathname: "/orders/[id]", params: { id: order.id } }}
            variant="outline"
          >
            View order
          </Button>
        </View>
      ))}
    </Screen>
  );
}

function StatusBadge({
  label,
  payment = false
}: {
  label: string;
  payment?: boolean;
}) {
  return (
    <Text
      selectable
      adjustsFontSizeToFit
      minimumFontScale={0.82}
      numberOfLines={1}
      style={{
        backgroundColor: payment ? "#EEF3F1" : colors.primarySoft,
        borderRadius: 999,
        color: payment ? colors.text : colors.primaryDark,
        fontFamily: fonts.bodySemiBold,
        fontSize: 10,
        paddingHorizontal: 10,
        paddingVertical: 6
      }}
    >
      {label}
    </Text>
  );
}
