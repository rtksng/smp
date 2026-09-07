import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Linking, Text, TextInput, View } from "react-native";
import { AccountInfoGrid, AccountPageHeader } from "@/components/account-layout";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import {
  cancelOrder,
  getOrder,
  reorder,
  requestReturn
} from "@/lib/api/orders";
import {
  createRazorpayOrder,
  verifyRazorpayPayment
} from "@/lib/api/payments";
import { useAuth } from "@/lib/auth/auth-context";
import { canCancelOrder, canRequestReturn, canRetryOnlinePayment, getOrderRefreshInterval } from "@/lib/commerce/orders";
import { canDownloadOrderInvoice, shareOrderInvoice } from "@/lib/api/invoices";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatRupees, formatStatus } from "@/lib/format";
import {
  normalizeRazorpayContact,
  openRazorpayCheckout
} from "@/lib/payments/razorpay";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function OrderDetailScreen() {
  const { id, paymentError } = useLocalSearchParams<{
    id: string;
    paymentError?: string;
  }>();
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(
    paymentError ?? null
  );
  const orderQuery = useQuery({
    enabled: Boolean(session && id),
    queryFn: () => getOrder(id),
    queryKey: queryKeys.order(id),
    refetchInterval: (query) => query.state.data ? getOrderRefreshInterval(query.state.data.status) : false
  });
  const invoiceMutation = useMutation({
    mutationFn: async () => {
      if (orderQuery.data) await shareOrderInvoice(orderQuery.data);
    }
  });
  const proofMutation = useMutation({ mutationFn: (url: string) => Linking.openURL(url) });

  useEffect(() => {
    if (isReady && !session) {
      router.replace(`/login?returnTo=/orders/${id}`);
    }
  }, [id, isReady, session]);
  const actionMutation = useMutation({
    mutationFn: async (action: "cancel" | "reorder" | "return") => {
      if (action === "cancel") {
        return cancelOrder(id, reason);
      }
      if (action === "return") {
        return requestReturn(id, reason);
      }

      await reorder(id);
      return null;
    },
    onSuccess: async (result, action) => {
      if (action === "reorder") {
        await queryClient.invalidateQueries({ queryKey: ["customer", "cart"] });
        router.push("/cart");
        return;
      }

      if (result) {
        queryClient.setQueryData(queryKeys.order(id), result);
        await queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      }
      setReason("");
      setActionMessage(
        action === "cancel"
          ? "Order cancelled."
          : "Return request submitted for review."
      );
    }
  });
  const paymentMutation = useMutation({
    mutationFn: async () => {
      const order = orderQuery.data;

      if (!order) {
        throw new Error("Order is unavailable.");
      }

      const paymentOrder = await createRazorpayOrder(order.id);
      const payment = await openRazorpayCheckout({
        amount: paymentOrder.razorpay.amount,
        currency: paymentOrder.razorpay.currency,
        description: order.orderNumber,
        key: paymentOrder.razorpay.keyId,
        name: "Surgical Medical Equipment",
        order_id: paymentOrder.razorpay.orderId,
        prefill: {
          contact: normalizeRazorpayContact(
            order.shippingAddress?.mobileNumber
          ),
          email: session?.customer.email ?? undefined,
          name: order.shippingAddress?.fullName
        },
        theme: { color: colors.primaryDark }
      });

      if (!payment.razorpay_order_id || !payment.razorpay_signature) {
        throw new Error("Payment confirmation was incomplete.");
      }

      return verifyRazorpayPayment({
        orderId: order.id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature
      });
    },
    onSuccess: async () => {
      setActionMessage("Payment completed successfully.");
      await Promise.all([
        orderQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders })
      ]);
    }
  });

  function confirmOrderAction(action: "cancel" | "return") {
    const isCancel = action === "cancel";
    Alert.alert(
      isCancel ? "Cancel this order?" : "Request a return?",
      isCancel
        ? "This action cannot be undone after the cancellation is accepted."
        : "The return request will be sent to the support team for review.",
      [
        { style: "cancel", text: "Go back" },
        {
          onPress: () => actionMutation.mutate(action),
          style: isCancel ? "destructive" : "default",
          text: isCancel ? "Cancel order" : "Request return"
        }
      ]
    );
  }

  if (!isReady || (session && orderQuery.isLoading)) {
    return (
      <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
        <AccountPageHeader description="Review order items, delivery address, payment details, timeline, and invoice." title="Order detail" />
        <LoadingState label="Loading order" />
      </Screen>
    );
  }

  if (!session) return null;

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
        <AccountPageHeader description="Review order items, delivery address, payment details, timeline, and invoice." title="Order detail" />
        <ErrorState
          message={getErrorMessage(orderQuery.error, "Unable to load order.")}
          onRetry={() => void orderQuery.refetch()}
          title="Unable to load order"
        />
      </Screen>
    );
  }

  const order = orderQuery.data;
  const canCancel = canCancelOrder(order.status);
  const canReturn = canRequestReturn(order.status, order.refunds);
  const canRetryPayment = canRetryOnlinePayment(order);
  const isActionPending = actionMutation.isPending || paymentMutation.isPending;
  const latestRefund = order.refunds[0];
  const statusEntries = order.statusHistory.length ? order.statusHistory : [
    { id: `${order.id}-current`, status: order.status, createdAt: order.createdAt, note: null }
  ];

  return (
    <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
      <AccountPageHeader description="Review order items, delivery address, payment details, timeline, and invoice." title={`Order ${order.orderNumber}`} />
      <AccountInfoGrid items={[
        { label: "Order number", value: order.orderNumber },
        { label: "Date", value: formatDate(order.placedAt ?? order.createdAt) },
        { label: "Status", value: formatStatus(order.status) },
        { label: "Total", value: formatRupees(order.totals.grandTotal) }
      ]} />

      {actionMessage || actionMutation.error || paymentMutation.error || proofMutation.error ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={{
            backgroundColor:
              actionMutation.error || paymentMutation.error || proofMutation.error
                ? colors.dangerBackground
                : colors.primarySoft,
            borderRadius: 10,
            color:
              actionMutation.error || paymentMutation.error || proofMutation.error
                ? colors.danger
                : colors.primaryDark,
            fontFamily: fonts.bodySemiBold,
            lineHeight: 20,
            padding: 12
          }}
        >
          {actionMutation.error || paymentMutation.error || proofMutation.error
            ? getErrorMessage(
                actionMutation.error ?? paymentMutation.error ?? proofMutation.error,
                "Unable to complete the action."
              )
            : actionMessage}
        </Text>
      ) : null}

      <OrderSection icon="package-variant" title="Items">
        {order.items.map((item) => (
          <View
            key={item.id}
            style={{
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
              gap: 4,
              paddingBottom: 12
            }}
          >
            <Text
              selectable
              style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 13 }}
            >
              {item.name}
            </Text>
            <Text
              selectable
              style={{
                color: colors.muted,
                fontFamily: fonts.body,
                fontSize: 11
              }}
            >
              SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%
            </Text>
            <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{formatRupees(item.unitPrice)} each</Text>
            <Text
              selectable
              style={{
                color: colors.ink,
                fontFamily: fonts.bodySemiBold,
                fontSize: 13
              }}
            >
              {formatRupees(item.total)}
            </Text>
          </View>
        ))}
      </OrderSection>

      <OrderSection icon="map-marker-outline" title="Delivery address">
        {order.shippingAddress ? (
          <>
            <Text
              selectable
              style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 13 }}
            >
              {order.shippingAddress.fullName}
            </Text>
            <Text
              selectable
              style={{
                color: colors.muted,
                fontFamily: fonts.body,
                lineHeight: 20
              }}
            >
              {order.shippingAddress.line1}
              {order.shippingAddress.line2
                ? `, ${order.shippingAddress.line2}`
                : ""}
              {"\n"}
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.pincode}
              {"\n"}
              {order.shippingAddress.mobileNumber}
            </Text>
          </>
        ) : (
          <Text
            selectable
            style={{ color: colors.danger, fontFamily: fonts.bodySemiBold }}
          >
            Delivery address is unavailable.
          </Text>
        )}
      </OrderSection>

      <OrderSection icon="timeline-clock-outline" title="Order timeline">
        {statusEntries.map((entry) => (
          <View key={entry.id} style={{ flexDirection: "row", gap: 10 }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.primarySoft,
                borderRadius: 14,
                height: 28,
                justifyContent: "center",
                width: 28
              }}
            >
              <MaterialCommunityIcons
                color={colors.primaryDark}
                name="check"
                size={15}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                selectable
                style={{
                  color: colors.text,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 12
                }}
              >
                {formatStatus(entry.status)}
              </Text>
              <Text
                selectable
                style={{
                  color: colors.muted,
                  fontFamily: fonts.body,
                  fontSize: 10
                }}
              >
                {formatDate(entry.createdAt)}
                {entry.note ? ` · ${entry.note}` : ""}
              </Text>
            </View>
          </View>
        ))}
      </OrderSection>

      {order.deliveryTracking.length ? (
        <OrderSection icon="truck-delivery-outline" title="Delivery tracking">
          {order.deliveryTracking.map((delivery) => (
            <View key={delivery.id} style={{ gap: 4 }}>
              <Text
                selectable
                style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 13 }}
              >
                {formatStatus(delivery.status)}
              </Text>
              <Text
                selectable
                style={{
                  color: colors.muted,
                  fontFamily: fonts.body,
                  lineHeight: 19
                }}
              >
                {delivery.deliveryPartnerName ?? "Delivery partner will be assigned"}
                {delivery.vehicleNumber ? ` · ${delivery.vehicleNumber}` : ""}
              </Text>
              {delivery.failureReason ? <Text accessibilityRole="alert" selectable style={{ color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{delivery.failureReason}</Text> : null}
              {delivery.proofOfDeliveryUrl && /^https?:\/\//i.test(delivery.proofOfDeliveryUrl) ? (
                <Button loading={proofMutation.isPending} onPress={() => proofMutation.mutate(delivery.proofOfDeliveryUrl!)} variant="outline">View proof of delivery</Button>
              ) : null}
              <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 12, marginTop: 8, paddingTop: 12 }}>
                {delivery.statusHistory.map((entry) => (
                  <View key={entry.id} style={{ gap: 4 }}>
                    <Text selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{formatStatus(entry.status)}</Text>
                    <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{formatDate(entry.createdAt)}{entry.latitude !== null && entry.longitude !== null ? ` | ${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}` : ""}</Text>
                    {entry.note ? <Text selectable style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 }}>{entry.note}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </OrderSection>
      ) : null}

      <OrderSection icon="receipt-text-outline" title="Payment summary">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Text selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Payment: {formatStatus(order.paymentStatus)}</Text>
          <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Method: {order.paymentMethod ? formatStatus(order.paymentMethod) : "Not selected"}</Text>
        </View>
        {latestRefund ? (
          <View style={{ backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 8, padding: 12 }}>
            <OrderInfoRow label="Return/refund" value={formatStatus(latestRefund.status)} />
            <OrderInfoRow label="Refund amount" value={formatRupees(latestRefund.amount)} />
            <OrderInfoRow label="Requested" value={formatDate(latestRefund.createdAt)} />
            {latestRefund.processedAt ? <OrderInfoRow label="Processed" value={formatDate(latestRefund.processedAt)} /> : null}
            {latestRefund.providerRefundId ? <OrderInfoRow label="Provider reference" value={latestRefund.providerRefundId} /> : null}
            {latestRefund.reason ? <OrderInfoRow label="Reason" value={latestRefund.reason} /> : null}
          </View>
        ) : null}
        <SummaryRow label="Subtotal" value={order.totals.subtotal} />
        <SummaryRow label="Tax" value={order.totals.tax} />
        <SummaryRow label="Delivery" value={order.totals.deliveryCharge} />
        <SummaryRow label="Discount" value={-order.totals.discount} />
        <View
          style={{
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: 10
          }}
        >
          <SummaryRow label="Total" strong value={order.totals.grandTotal} />
        </View>
      </OrderSection>

      <OrderSection icon="file-document-outline" title="Order actions">
      {canDownloadOrderInvoice(order) ? (
        <Button loading={invoiceMutation.isPending} onPress={() => invoiceMutation.mutate()} variant="outline">Download PDF invoice</Button>
      ) : (
        <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20 }}>Invoice is available after the order is confirmed and payment requirements are met.</Text>
      )}
      {invoiceMutation.error ? <Text accessibilityRole="alert" selectable style={{ color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{getErrorMessage(invoiceMutation.error, "Unable to download invoice.")}</Text> : null}
      {canRetryPayment ? (
        <Button
          disabled={isActionPending}
          loading={paymentMutation.isPending}
          onPress={() => paymentMutation.mutate()}
        >
          Retry online payment
        </Button>
      ) : null}
      <Button
        disabled={isActionPending}
        loading={
          actionMutation.isPending && actionMutation.variables === "reorder"
        }
        onPress={() => actionMutation.mutate("reorder")}
        variant="outline"
      >
        Reorder these items
      </Button>
      <Button href="/orders" variant="outline">Back to orders</Button>
      </OrderSection>
      {canCancel || canReturn ? (
        <View style={{ ...cardStyle, borderRadius: 8, gap: 11, padding: 16 }}>
          <Text
            selectable
            style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 15 }}
          >
            {canCancel ? "Cancel order" : "Request a return"}
          </Text>
          <TextInput
            editable={!isActionPending}
            accessibilityLabel={
              canCancel ? "Cancellation reason" : "Return reason"
            }
            autoCapitalize="sentences"
            autoCorrect
            multiline
            onChangeText={setReason}
            placeholder={
              canCancel ? "Cancellation reason (optional)" : "Return reason"
            }
            placeholderTextColor={colors.muted}
            returnKeyType="default"
            style={{
              borderColor: "#9FD7D1",
              borderRadius: 10,
              borderWidth: 1,
              color: colors.text,
              fontFamily: fonts.body,
              minHeight: 88,
              padding: 12,
              textAlignVertical: "top"
            }}
            value={reason}
          />
          <Button
            disabled={isActionPending}
            loading={
              actionMutation.isPending &&
              actionMutation.variables === (canCancel ? "cancel" : "return")
            }
            onPress={() =>
              confirmOrderAction(canCancel ? "cancel" : "return")
            }
            variant={canCancel ? "danger" : "outline"}
          >
            {canCancel ? "Cancel order" : "Submit return request"}
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}

function OrderInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
      <Text selectable style={{ color: colors.muted, flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{label}</Text>
      <Text selectable style={{ color: colors.text, flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function OrderSection({
  children,
  icon,
  title
}: PropsWithChildren<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
}>) {
  return (
    <View style={{ ...cardStyle, borderRadius: 8, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.primarySoft,
            borderRadius: 10,
            height: 36,
            justifyContent: "center",
            width: 36
          }}
        >
          <MaterialCommunityIcons color={colors.primaryDark} name={icon} size={19} />
        </View>
        <Text
          selectable
          style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 16 }}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function SummaryRow({
  label,
  strong = false,
  value
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between"
      }}
    >
      <Text
        selectable
        style={{
          color: strong ? colors.ink : colors.muted,
          fontFamily: strong ? fonts.heading : fonts.bodySemiBold,
          fontSize: strong ? 15 : 12
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: strong ? colors.ink : colors.text,
          fontFamily: strong ? fonts.headingBold : fonts.bodySemiBold,
          fontSize: strong ? 16 : 12,
          fontVariant: ["tabular-nums"]
        }}
      >
        {formatRupees(value)}
      </Text>
    </View>
  );
}
