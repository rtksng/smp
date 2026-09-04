import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "@/components/ui/state-view";
import { getCart } from "@/lib/api/cart";
import { createAddress, listAddresses, updateAddress } from "@/lib/api/customer";
import { validateCoupon, type CouponValidation } from "@/lib/api/coupons";
import { createOrder } from "@/lib/api/orders";
import {
  createRazorpayOrder,
  getPaymentGatewayStatus,
  verifyRazorpayPayment
} from "@/lib/api/payments";
import { addressInputSchema, type Address, type AddressInput, type AddressType, type CartItem, type PaymentMethod } from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { buildCheckoutIdempotencyKey, buildCheckoutQuoteKey, calculateCheckoutTotal } from "@/lib/commerce/checkout";
import { getErrorMessage } from "@/lib/errors";
import { formatRupees, formatStatus } from "@/lib/format";
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
  const [addressForm, setAddressForm] = useState<Address | "new" | null>(null);
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
    queryKey: buildCheckoutQuoteKey(selectedAddressId, addressesQuery.data?.find((address) => address.id === selectedAddressId)?.pincode),
    staleTime: 0
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

  const hasBlockingStockIssue = cart.items.some(
    (item) => !item.isAvailable || item.quantity > item.availableQuantity
  );
  const selectedAddress = addressesQuery.data?.find(
    (address) => address.id === selectedAddressId
  );
  const payableTotal = calculateCheckoutTotal(cart.totals, appliedCoupon?.discount);
  const onlineEnabled = Boolean(gatewayQuery.data?.onlinePaymentEnabled);
  const isUpdatingTotals = cartQuery.isFetching || addressesQuery.isFetching;

  async function handlePlaceOrder() {
    if (processingRef.current) {
      return;
    }
    if (isUpdatingTotals || addressForm !== null) {
      setSubmitError("Finish updating your delivery address and total before placing the order.");
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
        const reason = getErrorMessage(error, "Payment was not completed.");
        router.replace(
          `/payment-failed?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(reason)}` as Href
        );
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
      <View style={{ ...cardStyle, borderRadius: 8, gap: 10, padding: 18 }}>
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
        subtitle={`${cart.itemCount} product${cart.itemCount === 1 ? "" : "s"} / ${cart.totalQuantity} unit${cart.totalQuantity === 1 ? "" : "s"}`}
        title="Cart review"
      >
        {cart.items.map((item) => (
          <CheckoutCartItem item={item} key={item.id} />
        ))}
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 10, paddingTop: 14 }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Need to change quantities or remove items?</Text>
          <Button href="/cart" variant="outline">Back to cart</Button>
        </View>
      </CheckoutSection>

      <CheckoutSection
        action={<Button onPress={() => setAddressForm("new")} variant="outline">Add address</Button>}
        icon="map-marker-outline"
        subtitle="Choose a saved address or add a new one."
        title="Delivery address"
      >
        {addressesQuery.data?.length ? (
          addressesQuery.data.map((address) => (
            <AddressChoice
              address={address}
              checked={address.id === selectedAddressId}
              key={address.id}
              onEdit={() => setAddressForm(address)}
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
      </CheckoutSection>

      {addressForm ? (
        <CheckoutAddressForm
          address={addressForm === "new" ? null : addressForm}
          key={addressForm === "new" ? "new" : addressForm.id}
          onCancel={() => setAddressForm(null)}
          onSaved={(address) => {
            setSelectedAddressId(address.id);
            setAddressForm(null);
          }}
        />
      ) : null}

      <CheckoutSection
        icon="credit-card-outline"
        subtitle="Choose a supported payment method"
        title="Payment method"
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

      <View style={{ ...cardStyle, borderRadius: 8, gap: 16, padding: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.background, borderRadius: 8, height: 40, justifyContent: "center", width: 40 }}><MaterialCommunityIcons color={colors.primaryDark} name="shield-check-outline" size={20} /></View>
          <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 18 }}>Order summary</Text><Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{cart.totalQuantity} unit{cart.totalQuantity === 1 ? "" : "s"} ready for confirmation.</Text></View>
        </View>

        <View style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 8, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}><MaterialCommunityIcons color={colors.primaryDark} name="truck-outline" size={16} /><Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Delivery</Text></View>
          <Text style={{ color: selectedAddress ? colors.muted : colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 21 }}>{selectedAddress ? `${selectedAddress.fullName}, ${[selectedAddress.addressLine1, selectedAddress.addressLine2, selectedAddress.city, selectedAddress.state, selectedAddress.pincode].filter(Boolean).join(", ")}` : "Select a delivery address."}</Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}><MaterialCommunityIcons color={colors.primaryDark} name="ticket-percent-outline" size={16} /><Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Promo code</Text></View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput accessibilityLabel="Promo code" autoCapitalize="characters" autoCorrect={false} editable={!appliedCoupon} onChangeText={(value) => { setCouponCode(value); couponMutation.reset(); }} placeholder="Enter code" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surface, borderColor: "#9FD7D1", borderRadius: 999, borderWidth: 1, color: colors.text, flex: 1, fontFamily: fonts.bodySemiBold, minHeight: 48, paddingHorizontal: 16 }} value={couponCode} />
            <Button disabled={!appliedCoupon && !couponCode.trim()} loading={!appliedCoupon && couponMutation.isPending} onPress={() => { if (appliedCoupon) { setAppliedCoupon(null); setCouponCode(""); couponMutation.reset(); } else { couponMutation.mutate(couponCode); } }} variant="outline">{appliedCoupon ? "Remove" : "Apply"}</Button>
          </View>
          {appliedCoupon ? <Text style={{ backgroundColor: colors.primarySoft, borderRadius: 8, color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 13, padding: 10 }}>{appliedCoupon.message}</Text> : null}
          {couponMutation.error ? <Text accessibilityRole="alert" style={{ backgroundColor: colors.dangerBackground, borderRadius: 8, color: "#7A271A", fontFamily: fonts.bodySemiBold, fontSize: 13, padding: 10 }}>{getErrorMessage(couponMutation.error, "Unable to apply promo code.")}</Text> : null}
        </View>

        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12, textTransform: "uppercase" }}>Price details</Text>
          <SummaryRow label="Subtotal" value={cart.totals.subtotal} />
          <SummaryRow label="Discount" value={-(appliedCoupon?.discount ?? cart.totals.discount)} />
          <SummaryRow label="Delivery charge" value={cart.totals.deliveryCharge} />
          <SummaryRow label="Tax/GST" value={cart.totals.tax} />
          <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12 }}><SummaryRow label="Total payable" strong value={payableTotal} /></View>
        </View>
        <Text style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13, padding: 12 }}>Payment: <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold }}>{paymentMethod === "COD" ? "Cash on delivery" : "Online payment"}</Text></Text>
        {hasBlockingStockIssue ? <Text accessibilityRole="alert" style={{ backgroundColor: colors.dangerBackground, borderColor: "#F4C7C3", borderRadius: 8, borderWidth: 1, color: "#7A271A", fontFamily: fonts.bodySemiBold, fontSize: 13, padding: 12 }}>Some cart quantities are no longer available. Update your cart before checkout.</Text> : null}
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
          disabled={!selectedAddressId || hasBlockingStockIssue || isUpdatingTotals || addressForm !== null}
          loading={isProcessing}
          onPress={() => void handlePlaceOrder()}
        >
          {paymentMethod === "ONLINE" ? "Place order and pay" : "Place COD order"}
        </Button>
        <Button href="/cart" variant="outline">Back to cart</Button>
      </View>
    </Screen>
  );
}

function CheckoutCartItem({ item }: { item: CartItem }) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 12
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 72, overflow: "hidden", width: 72 }}>
          {item.imageUrl ? (
            <Image accessibilityLabel={item.name} contentFit="cover" source={{ uri: item.imageUrl }} style={{ height: "100%", width: "100%" }} />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}><MaterialCommunityIcons color={colors.primaryDark} name="medical-bag" size={28} /></View>
          )}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text numberOfLines={2} selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 }}>{item.name}</Text>
          <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>SKU {item.sku}{item.variantName ? ` | ${item.variantName}` : ""} | Qty {item.quantity} | {item.taxRate}% GST</Text>
          {!item.isAvailable || item.quantity > item.availableQuantity ? <Text accessibilityRole="alert" selectable style={{ backgroundColor: colors.dangerBackground, borderColor: "#F4C7C3", borderRadius: 8, borderWidth: 1, color: "#7A271A", fontFamily: fonts.bodySemiBold, fontSize: 12, padding: 8 }}>Only {item.availableQuantity} currently available.</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <CheckoutMetric label="Unit" value={formatRupees(item.unitPrice)} />
        <CheckoutMetric label="Tax" value={formatRupees(item.tax)} />
        <CheckoutMetric label="Total" value={formatRupees(item.total)} />
      </View>
    </View>
  );
}

function CheckoutMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, gap: 2, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 10, textTransform: "uppercase" }}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{value}</Text>
    </View>
  );
}

const checkoutAddressTypes: AddressType[] = ["CLINIC", "HOSPITAL", "WORK", "HOME", "OTHER"];

function CheckoutAddressForm({ address, onCancel, onSaved }: { address: Address | null; onCancel: () => void; onSaved: (address: Address) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AddressInput>({
    addressLine1: address?.addressLine1 ?? "",
    addressLine2: address?.addressLine2 ?? null,
    city: address?.city ?? "",
    fullName: address?.fullName ?? "",
    landmark: address?.landmark ?? null,
    phone: address?.phone ?? "+91",
    pincode: address?.pincode ?? "",
    state: address?.state ?? "",
    type: address?.type ?? "CLINIC"
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: (input: AddressInput) => address ? updateAddress(address.id, input) : createAddress(input),
    onSuccess: async (savedAddress) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      onSaved(savedAddress);
    }
  });

  function updateField<Field extends keyof AddressInput>(field: Field, value: AddressInput[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function submit() {
    const parsed = addressInputSchema.safeParse({ ...form, addressLine2: form.addressLine2?.trim() || null, landmark: form.landmark?.trim() || null });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    mutation.mutate(parsed.data);
  }

  return (
    <View style={{ ...cardStyle, borderRadius: 8, gap: 16, padding: 16 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 16 }}>{address ? "Edit delivery address" : "Add delivery address"}</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20 }}>Use an address that can receive medical equipment deliveries.</Text>
      </View>
      <TextField error={fieldErrors.fullName} label="Full name" onChangeText={(value) => updateField("fullName", value)} value={form.fullName} />
      <TextField error={fieldErrors.phone} keyboardType="phone-pad" label="Mobile number" onChangeText={(value) => updateField("phone", value)} value={form.phone} />
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>Address type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {checkoutAddressTypes.map((type) => (
            <Pressable key={type} onPress={() => updateField("type", type)} style={{ backgroundColor: form.type === type ? colors.primaryDark : colors.surface, borderColor: colors.primaryDark, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 13 }}>
              <Text style={{ color: form.type === type ? colors.surface : colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{formatStatus(type)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <TextField error={fieldErrors.addressLine1} label="Address line 1" multiline onChangeText={(value) => updateField("addressLine1", value)} style={{ borderRadius: 8, minHeight: 76, paddingTop: 13, textAlignVertical: "top" }} value={form.addressLine1} />
      <TextField label="Address line 2 (optional)" onChangeText={(value) => updateField("addressLine2", value)} value={form.addressLine2 ?? ""} />
      <TextField label="Landmark (optional)" onChangeText={(value) => updateField("landmark", value)} value={form.landmark ?? ""} />
      <TextField error={fieldErrors.city} label="City" onChangeText={(value) => updateField("city", value)} value={form.city} />
      <TextField error={fieldErrors.state} label="State" onChangeText={(value) => updateField("state", value)} value={form.state} />
      <TextField error={fieldErrors.pincode} keyboardType="number-pad" label="Pincode" maxLength={6} onChangeText={(value) => updateField("pincode", value)} value={form.pincode} />
      {mutation.isError ? <Text accessibilityRole="alert" style={{ backgroundColor: colors.dangerBackground, borderRadius: 8, color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 13, padding: 12 }}>{getErrorMessage(mutation.error, "Unable to save address.")}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button loading={mutation.isPending} onPress={submit}>{address ? "Update address" : "Save address"}</Button>
        <Button disabled={mutation.isPending} onPress={onCancel} variant="outline">Cancel</Button>
      </View>
    </View>
  );
}

function CheckoutSection({
  action,
  children,
  icon,
  subtitle,
  title
}: PropsWithChildren<{
  action?: ReactNode;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  subtitle: string;
  title: string;
}>) {
  return (
    <View style={{ ...cardStyle, borderRadius: 8, gap: 13, padding: 16 }}>
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
        {action}
      </View>
      {children}
    </View>
  );
}

function AddressChoice({
  address,
  checked,
  onEdit,
  onPress
}: {
  address: Address;
  checked: boolean;
  onEdit: () => void;
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
      <Pressable
        accessibilityLabel={`Edit ${address.fullName} address`}
        accessibilityRole="button"
        onPress={(event) => {
          event.stopPropagation();
          onEdit();
        }}
        style={({ pressed }) => ({
          alignItems: "center",
          borderColor: colors.border,
          borderRadius: 8,
          borderWidth: 1,
          height: 34,
          justifyContent: "center",
          opacity: pressed ? 0.72 : 1,
          width: 34
        })}
      >
        <MaterialCommunityIcons color={colors.primaryDark} name="pencil-outline" size={16} />
      </Pressable>
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
