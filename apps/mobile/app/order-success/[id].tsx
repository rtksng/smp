import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, type ReactNode } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { getOrder } from "@/lib/api/orders";
import type { Order } from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatRupees, formatStatus } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export default function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isReady, session } = useAuth();
  const orderQuery = useQuery({
    enabled: Boolean(session && id),
    queryFn: () => getOrder(id),
    queryKey: queryKeys.order(id)
  });

  useEffect(() => {
    if (isReady && !session) {
      router.replace(`/login?returnTo=/order-success/${encodeURIComponent(id)}`);
    }
  }, [id, isReady, session]);

  if (!isReady || (session && orderQuery.isLoading)) {
    return <Screen><LoadingState label="Loading order confirmation" /></Screen>;
  }

  if (!session) {
    return null;
  }

  if (orderQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message={getErrorMessage(orderQuery.error, "Unable to load order confirmation.")}
          onRetry={() => void orderQuery.refetch()}
          title="Unable to load order"
        />
      </Screen>
    );
  }

  return orderQuery.data ? <OrderConfirmation order={orderQuery.data} /> : null;
}

function OrderConfirmation({ order }: { order: Order }) {
  const statusEntries = order.statusHistory.length
    ? order.statusHistory
    : [{ changedById: null, createdAt: order.createdAt, id: `${order.id}-current`, note: null, status: order.status }];

  return (
    <Screen gap={20}>
      <View style={surfaceStyle}>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <IconTile icon="check-circle-outline" size={24} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text selectable style={{ color: "#0F6F68", fontFamily: fonts.bodySemiBold, fontSize: 12, textTransform: "uppercase" }}>Order placed</Text>
            <Text selectable style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 24, lineHeight: 31 }}>Order confirmed</Text>
            <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 24 }}>
              Your order has been saved and is available in your account for status tracking.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Button href="/search" style={{ flexGrow: 1 }} variant="outline">Continue shopping</Button>
          <Button href="/orders" style={{ flexGrow: 1 }}>View orders</Button>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Metric label="Order number" value={order.orderNumber} />
          <Metric label="Date" value={`Placed ${formatDate(order.placedAt ?? order.createdAt)}`} />
          <Metric label="Products" value={formatItemCount(order)} />
          <Metric label="Amount" value={formatRupees(order.totals.grandTotal)} />
        </View>
      </View>

      <Section icon="package-variant-closed" subtitle={`${formatItemCount(order)} confirmed in this order.`} title="Order items">
        {order.items.map((item, index) => (
          <View key={item.id} style={{ borderTopColor: colors.border, borderTopWidth: index ? 1 : 0, gap: 5, paddingTop: index ? 16 : 0 }}>
            <Text selectable style={itemTitleStyle}>{item.name}</Text>
            <Text selectable style={detailStyle}>SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%</Text>
            <View style={rowStyle}>
              <Text selectable style={detailStyle}>{formatRupees(item.unitPrice)} each</Text>
              <Text selectable style={valueStyle}>{formatRupees(item.total)}</Text>
            </View>
          </View>
        ))}
      </Section>

      <Section icon="map-marker-outline" subtitle="Destination captured when the order was placed." title="Delivery details">
        {order.shippingAddress ? (
          <View style={innerSurfaceStyle}>
            <Text selectable style={itemTitleStyle}>{order.shippingAddress.fullName}</Text>
            <Text selectable style={detailStyle}>{[order.shippingAddress.line1, order.shippingAddress.line2].filter(Boolean).join(", ")}</Text>
            <Text selectable style={detailStyle}>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}, {order.shippingAddress.country}</Text>
            <Text selectable style={detailStyle}>{order.shippingAddress.mobileNumber}</Text>
          </View>
        ) : (
          <Text selectable style={errorStyle}>Delivery address is not available for this order.</Text>
        )}
      </Section>

      <Section icon="refresh" subtitle="Latest status changes for this order." title="Status timeline">
        {statusEntries.map((entry) => (
          <View key={entry.id} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", backgroundColor: "#D8F1EE", borderRadius: 14, height: 28, justifyContent: "center", width: 28 }}>
              <MaterialCommunityIcons color="#0F6F68" name="clipboard-check-outline" size={15} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={itemTitleStyle}>{formatStatus(entry.status)}</Text>
              <Text selectable style={detailStyle}>{formatDate(entry.createdAt)}</Text>
              {entry.note ? <Text selectable style={detailStyle}>{entry.note}</Text> : null}
            </View>
          </View>
        ))}
      </Section>

      <Section icon="receipt-text-outline" subtitle="Final amount saved for this order." title="Payment summary">
        <InfoRow label="Method" value={order.paymentMethod ? formatStatus(order.paymentMethod) : "Not selected"} />
        <InfoRow label="Payment status" value={formatStatus(order.paymentStatus)} />
        <InfoRow label="Subtotal" value={formatRupees(order.totals.subtotal)} />
        <InfoRow label="Discount" value={formatRupees(-order.totals.discount)} />
        <InfoRow label="Delivery charge" value={formatRupees(order.totals.deliveryCharge)} />
        <InfoRow label="Tax/GST" value={formatRupees(order.totals.tax)} />
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12 }}>
          <InfoRow label="Total" strong value={formatRupees(order.totals.grandTotal)} />
        </View>
      </Section>

      <Section icon="truck-outline" subtitle="Current order and payment state." title="Current status">
        <StatusRow icon="package-variant-closed" label="Order" value={formatStatus(order.status)} />
        <StatusRow icon="credit-card-outline" label="Payment" value={formatStatus(order.paymentStatus)} />
      </Section>
    </Screen>
  );
}

function Section({ children, icon, subtitle, title }: { children: ReactNode; icon: keyof typeof MaterialCommunityIcons.glyphMap; subtitle: string; title: string }) {
  return (
    <View style={surfaceStyle}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <IconTile icon={icon} size={19} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 16 }}>{title}</Text>
          <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 20 }}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function IconTile({ icon, size }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; size: number }) {
  return <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 40, justifyContent: "center", width: 40 }}><MaterialCommunityIcons color={colors.primaryDark} name={icon} size={size} /></View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ ...innerSurfaceStyle, flexBasis: "47%", flexGrow: 1 }}><Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 11, textTransform: "uppercase" }}>{label}</Text><Text selectable style={itemTitleStyle}>{value}</Text></View>;
}

function InfoRow({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return <View style={rowStyle}><Text selectable style={{ color: strong ? colors.ink : colors.muted, fontFamily: fonts.bodySemiBold, fontSize: strong ? 16 : 14 }}>{label}</Text><Text selectable style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: strong ? 16 : 14, textAlign: "right" }}>{value}</Text></View>;
}

function StatusRow({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return <View style={{ ...innerSurfaceStyle, alignItems: "center", flexDirection: "row", gap: 12 }}><View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 8, height: 32, justifyContent: "center", width: 32 }}><MaterialCommunityIcons color={colors.primaryDark} name={icon} size={17} /></View><View style={{ flex: 1 }}><Text selectable style={detailStyle}>{label}</Text><Text selectable style={itemTitleStyle}>{value}</Text></View></View>;
}

function formatItemCount(order: Order) {
  const quantity = order.items.reduce((total, item) => total + item.quantity, 0);
  return `${quantity} item${quantity === 1 ? "" : "s"}`;
}

const surfaceStyle = { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 16, padding: 20 } as const;
const innerSurfaceStyle = { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 6, padding: 16 } as const;
const rowStyle = { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" } as const;
const itemTitleStyle = { color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 } as const;
const detailStyle = { color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 20 } as const;
const valueStyle = { color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 16 } as const;
const errorStyle = { backgroundColor: colors.dangerBackground, borderRadius: 8, color: "#7A271A", fontFamily: fonts.bodySemiBold, fontSize: 14, padding: 16 } as const;
