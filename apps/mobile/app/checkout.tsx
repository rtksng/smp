import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "@/components/ui/state-view";
import { getCart } from "@/lib/api/cart";
import { listAddresses } from "@/lib/api/customer";
import { validateCoupon, type CouponValidation } from "@/lib/api/coupons";
import { createOrder } from "@/lib/api/orders";
import {
  createRazorpayOrder,
  getPaymentGatewayStatus,
  verifyRazorpayPayment
} from "@/lib/api/payments";
import type { Address, PaymentMethod } from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { buildCheckoutIdempotencyKey } from "@/lib/commerce/checkout";
import { getErrorMessage } from "@/lib/errors";
import { formatRupees } from "@/lib/format";
import {
  normalizeRazorpayContact,
  openRazorpayCheckout
} from "@/lib/payments/razorpay";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function CheckoutScreen() {
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const idempotencyKeyRef = useRef(buildCheckoutIdempotencyKey());
  const pendingOrderIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const addressesQuery = useQuery({
    enabled: Boolean(session),
    queryFn: listAddresses,
    queryKey: queryKeys.addresses
  });
  const cartQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => getCart(selectedAddressId),
    queryKey: queryKeys.cart(selectedAddressId)
  });
  const gatewayQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getPaymentGatewayStatus,
    queryKey: queryKeys.paymentGateway
  });
  const couponMutation = useMutation({
    mutationFn: validateCoupon,
    onSuccess: setAppliedCoupon
  });
  const orderMutation = useMutation({
    mutationFn: createOrder
  });

  useEffect(() => {
    const defaultAddress =
      addressesQuery.data?.find((address) => address.isDefault) ??
      addressesQuery.data?.[0];

    if (!selectedAddressId && defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [addressesQuery.data, selectedAddressId]);

  useEffect(() => {
    idempotencyKeyRef.current = buildCheckoutIdempotencyKey();
    pendingOrderIdRef.current = null;
  }, [appliedCoupon?.code, paymentMethod, selectedAddressId]);

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login?returnTo=/checkout");
    }
  }, [isReady, session]);

  if (isReady && !session) {
    return null;
  }

  if (!isReady || addressesQuery.isLoading || cartQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading checkout" />
      </Screen>
    );
  }

  if (addressesQuery.isError || cartQuery.isError) {
    const error = addressesQuery.error ?? cartQuery.error;
    return (
      <Screen>
        <ErrorState
          message={getErrorMessage(error, "Unable to load checkout.")}
          onRetry={() => {
            void addressesQuery.refetch();
            void cartQuery.refetch();
          }}
          title="Unable to load checkout"
        />
      </Screen>
    );
  }

  const cart = cartQuery.data;

  if (!cart || cart.items.length === 0) {
    return (
      <Screen>
        <EmptyState
          action={<Button href="/search">Continue shopping</Button>}
          description="Your cart is empty. Add products before checkout."
          title="No items to checkout"
        />
      </Screen>
    );
  }

  const hasBlockingStockIssue = cart.items.some((item) => !item.isAvailable);
  const selectedAddress = addressesQuery.data?.find(
    (address) => address.id === selectedAddressId
  );
  const payableTotal = appliedCoupon?.grandTotal ?? cart.totals.grandTotal;
  const onlineEnabled = Boolean(gatewayQuery.data?.onlinePaymentEnabled);

  async function handlePlaceOrder() {
    if (processingRef.current) {
      return;
    }
    if (!selectedAddressId) {
      setSubmitError("Select or add a delivery address.");
      return;
    }
    if (hasBlockingStockIssue) {
      setSubmitError("Remove unavailable items before placing the order.");
      return;
    }
    if (paymentMethod === "ONLINE" && !onlineEnabled) {
      setSubmitError(
        gatewayQuery.data?.message ?? "Online payment is currently unavailable."
      );
      return;
    }

    setSubmitError(null);
    processingRef.current = true;
    setIsProcessing(true);

    try {
      const order =
        pendingOrderIdRef.current === null
          ? await orderMutation.mutateAsync({
              couponCode: appliedCoupon?.code ?? null,
              idempotencyKey: idempotencyKeyRef.current,
              paymentMethod,
              shippingAddressId: selectedAddressId
            })
          : null;
      const orderId = order?.id ?? pendingOrderIdRef.current;

      if (!orderId) {
        throw new Error("Unable to identify the pending order.");
      }

      pendingOrderIdRef.current = orderId;

      if (paymentMethod === "COD") {
        await invalidateCheckoutQueries();
        router.replace({
          pathname: "/order-success/[id]",
          params: { id: orderId }
        });
        return;
      }

      const paymentOrder = await createRazorpayOrder(orderId);
      const payment = await openRazorpayCheckout({
        amount: paymentOrder.razorpay.amount,
        currency: paymentOrder.razorpay.currency,
        description: order?.orderNumber ?? "Surgical equipment order",
        key: paymentOrder.razorpay.keyId,
        name: "Surgical Medical Equipment",
        order_id: paymentOrder.razorpay.orderId,
        prefill: {
          contact: normalizeRazorpayContact(
            selectedAddress?.phone ?? session?.customer.mobileNumber
          ),
          email: session?.customer.email ?? undefined,
          name: selectedAddress?.fullName ?? session?.customer.firstName
        },
        theme: { color: colors.primaryDark }
      });

      if (!payment.razorpay_order_id || !payment.razorpay_signature) {
        throw new Error("Payment confirmation was incomplete.");
      }

      await verifyRazorpayPayment({
        orderId,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature
      });
      await invalidateCheckoutQueries();
      router.replace({ pathname: "/order-success/[id]", params: { id: orderId } });
    } catch (error) {
      const orderId = pendingOrderIdRef.current;

      if (paymentMethod === "ONLINE" && orderId) {
        await invalidateCheckoutQueries();
        router.replace({
          pathname: "/orders/[id]",
          params: {
            id: orderId,
            paymentError: getErrorMessage(error, "Payment was not completed.")
          }
        });
        return;
      }

      setSubmitError(getErrorMessage(error, "Unable to place order."));
      processingRef.current = false;
      setIsProcessing(false);
    }
  }

  async function invalidateCheckoutQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.orders })
    ]);
  }

  return (
    <Screen>
      <View style={{ ...cardStyle, gap: 10, padding: 18 }}>
        <Text
          selectable
          style={{
            color: colors.ink,
            fontFamily: fonts.headingBold,
            fontSize: 24
          }}
        >
          Checkout
        </Text>
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: fonts.body,
            lineHeight: 21
          }}
        >
          Review cart items, choose delivery, confirm payment, and place the order.
        </Text>
        <View
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderRadius: 10,
            borderWidth: 1,
            gap: 3,
            padding: 12
          }}
        >
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 10,
              textTransform: "uppercase"
            }}
          >
            Amount payable
          </Text>
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.headingBold,
              fontSize: 21,
              fontVariant: ["tabular-nums"]
            }}
          >
            {formatRupees(payableTotal)}
          </Text>
        </View>
      </View>

      <CheckoutSection
        icon="shopping-outline"
        subtitle={`${cart.totalQuantity} units in ${cart.itemCount} line items`}
        title="1. Review cart"
      >
        {cart.items.map((item) => (
          <View
            key={item.id}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              gap: 3,
              padding: 11
            }}
          >
            <Text
              selectable
              style={{
                color: colors.text,
                fontFamily: fonts.bodySemiBold,
                fontSize: 13
              }}
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
              Qty {item.quantity} · {formatRupees(item.total)}
            </Text>
            {!item.isAvailable ? (
              <Text
                accessibilityRole="alert"
                selectable
                style={{
                  color: colors.danger,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 11
                }}
              >
                Currently unavailable
              </Text>
            ) : null}
          </View>
        ))}
        <Button href="/cart" variant="outline">
          Edit cart
        </Button>
      </CheckoutSection>

      <CheckoutSection
        icon="map-marker-outline"
        subtitle="Choose where this order should be delivered"
        title="2. Delivery address"
      >
        {addressesQuery.data?.length ? (
          addressesQuery.data.map((address) => (
            <AddressChoice
              address={address}
              checked={address.id === selectedAddressId}
              key={address.id}
              onPress={() => setSelectedAddressId(address.id)}
            />
          ))
        ) : (
          <Text
            selectable
            style={{
              color: colors.danger,
              fontFamily: fonts.bodySemiBold,
              lineHeight: 20
            }}
          >
            Add a delivery address before placing your order.
          </Text>
        )}
        <Button href="/addresses/form" variant="outline">
          Add new address
        </Button>
      </CheckoutSection>

      <CheckoutSection
        icon="credit-card-outline"
        subtitle="Choose a supported payment method"
        title="3. Payment"
      >
        <PaymentChoice
          active={paymentMethod === "COD"}
          label="Cash on Delivery"
          onPress={() => setPaymentMethod("COD")}
          subtitle="Pay the delivery partner when the order arrives"
        />
        <PaymentChoice
          active={paymentMethod === "ONLINE"}
          disabled={!onlineEnabled}
          label="Pay online"
          onPress={() => setPaymentMethod("ONLINE")}
          subtitle={
            gatewayQuery.isLoading
              ? "Checking secure payment availability"
              : onlineEnabled
                ? "Complete payment securely with Razorpay"
                : gatewayQuery.data?.message ?? "Currently unavailable"
          }
        />
      </CheckoutSection>

      <CheckoutSection
        icon="ticket-percent-outline"
        subtitle="Apply an eligible promo code"
        title="4. Coupon"
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            accessibilityLabel="Promo code"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={(value) => {
              setCouponCode(value);
              couponMutation.reset();
            }}
            placeholder="Promo code"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (couponCode.trim() && !couponMutation.isPending) {
                couponMutation.mutate(couponCode);
              }
            }}
            style={{
              backgroundColor: colors.surface,
              borderColor: "#A9DDAE",
              borderRadius: 999,
              borderWidth: 1,
              color: colors.text,
              flex: 1,
              fontFamily: fonts.bodySemiBold,
              minHeight: 48,
              paddingHorizontal: 16
            }}
            value={couponCode}
          />
          <Button
            disabled={!couponCode.trim()}
            loading={couponMutation.isPending}
            onPress={() => couponMutation.mutate(couponCode)}
            variant="outline"
          >
            Apply
          </Button>
        </View>
        {appliedCoupon ? (
          <Text
            selectable
            style={{
              backgroundColor: colors.primarySoft,
              borderRadius: 10,
              color: colors.primaryDark,
              fontFamily: fonts.bodySemiBold,
              padding: 12
            }}
          >
            {appliedCoupon.message}
          </Text>
        ) : null}
        {couponMutation.error ? (
          <Text
            accessibilityRole="alert"
            selectable
            style={{
              backgroundColor: colors.dangerBackground,
              borderRadius: 10,
              color: colors.danger,
              fontFamily: fonts.bodySemiBold,
              padding: 12
            }}
          >
            {getErrorMessage(couponMutation.error, "Unable to apply promo code.")}
          </Text>
        ) : null}
      </CheckoutSection>

      <View style={{ ...cardStyle, gap: 11, padding: 18 }}>
        <Text
          selectable
          style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 18 }}
        >
          Order summary
        </Text>
        <SummaryRow label="Subtotal" value={cart.totals.subtotal} />
        <SummaryRow label="Tax" value={cart.totals.tax} />
        <SummaryRow label="Delivery" value={cart.totals.deliveryCharge} />
        <SummaryRow
          label="Discount"
          value={-(appliedCoupon?.discount ?? cart.totals.discount)}
        />
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 11 }}>
          <SummaryRow label="Amount payable" strong value={payableTotal} />
        </View>
        {submitError ? (
          <Text
            accessibilityRole="alert"
            selectable
            style={{
              backgroundColor: colors.dangerBackground,
              borderRadius: 10,
              color: colors.danger,
              fontFamily: fonts.bodySemiBold,
              lineHeight: 20,
              padding: 12
            }}
          >
            {submitError}
          </Text>
        ) : null}
        <Button
          disabled={!selectedAddressId || hasBlockingStockIssue}
          loading={isProcessing}
          onPress={() => void handlePlaceOrder()}
        >
          {paymentMethod === "ONLINE" ? "Place order and pay" : "Place COD order"}
        </Button>
      </View>
    </Screen>
  );
}

function CheckoutSection({
  children,
  icon,
  subtitle,
  title
}: PropsWithChildren<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  subtitle: string;
  title: string;
}>) {
  return (
    <View style={{ ...cardStyle, gap: 13, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.primarySoft,
            borderRadius: 10,
            height: 38,
            justifyContent: "center",
            width: 38
          }}
        >
          <MaterialCommunityIcons color={colors.primaryDark} name={icon} size={20} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            selectable
            style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 16 }}
          >
            {title}
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 11
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function AddressChoice({
  address,
  checked,
  onPress
}: {
  address: Address;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{
        backgroundColor: checked ? colors.background : colors.surfaceMuted,
        borderColor: checked ? colors.primaryDark : colors.border,
        borderRadius: 10,
        borderWidth: checked ? 2 : 1,
        flexDirection: "row",
        gap: 10,
        padding: 12
      }}
    >
      <MaterialCommunityIcons
        color={colors.primaryDark}
        name={checked ? "radiobox-marked" : "radiobox-blank"}
        size={20}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          selectable
          style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 13 }}
        >
          {address.fullName} · {address.type}
        </Text>
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: fonts.body,
            fontSize: 12,
            lineHeight: 18
          }}
        >
          {address.addressLine1}, {address.city}, {address.state} {address.pincode}
        </Text>
      </View>
    </Pressable>
  );
}

function PaymentChoice({
  active,
  disabled = false,
  label,
  onPress,
  subtitle
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  subtitle: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.background : colors.surfaceMuted,
        borderColor: active ? colors.primaryDark : colors.border,
        borderRadius: 10,
        borderWidth: active ? 2 : 1,
        flexDirection: "row",
        gap: 10,
        opacity: disabled ? 0.55 : 1,
        padding: 12
      }}
    >
      <MaterialCommunityIcons
        color={colors.primaryDark}
        name={active ? "radiobox-marked" : "radiobox-blank"}
        size={20}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          selectable
          style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 13 }}
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
    </Pressable>
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
          fontSize: strong ? 15 : 13
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: strong ? colors.ink : colors.text,
          fontFamily: strong ? fonts.headingBold : fonts.bodySemiBold,
          fontSize: strong ? 17 : 13,
          fontVariant: ["tabular-nums"]
        }}
      >
        {formatRupees(value)}
      </Text>
    </View>
  );
}
