"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  MapPin,
  Plus,
  ShieldCheck,
  Truck
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCart, type Cart } from "../../lib/api/cart";
import {
  getFriendlyApiErrorMessage,
  stockErrorMessage
} from "../../lib/api/error-messages";
import {
  createCustomerAddressInputSchema,
  listCustomerAddresses,
  type CreateCustomerAddressInput,
  type CustomerAddress
} from "../../lib/api/customer-profile";
import {
  createCheckoutOrderMutation,
  createCheckoutPaymentVerificationMutation,
  createCheckoutRazorpayOrderMutation,
  createCreateAddressMutation
} from "../../lib/api/mutation-helpers";
import { type PaymentMethod } from "../../lib/api/orders";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { getCheckoutSubmissionError } from "../../lib/checkout/checkout-validation";
import { openRazorpayCheckout } from "../../lib/checkout/razorpay";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { useCartStore } from "../../lib/stores/cart-store";
import { ProtectedCustomerRoute } from "../auth/protected-customer-route";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { EmptyState } from "../ui/empty-state";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Input } from "../ui/input";
import { SectionLoader } from "../ui/loading-spinner";

const priceFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

const emptyAddressForm: CreateCustomerAddressInput = {
  addressLine1: "",
  addressLine2: null,
  city: "",
  fullName: "",
  landmark: null,
  phone: "",
  pincode: "",
  state: "",
  type: "CLINIC"
};

type AddressFieldErrors = Partial<
  Record<keyof CreateCustomerAddressInput, string>
>;

export function CheckoutPage() {
  return (
    <>
      <Header />
      <main className="bg-[#f5f8f7]">
        <Container className="py-8">
          <ProtectedCustomerRoute>
            <CheckoutContent />
          </ProtectedCustomerRoute>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);
  const customer = useCustomerAuthStore((state) => state.session?.customer);
  const setCartSummary = useCartStore((state) => state.setSummary);
  const resetCartSummary = useCartStore((state) => state.reset);
  const [addressForm, setAddressForm] =
    useState<CreateCustomerAddressInput>(emptyAddressForm);
  const [addressErrors, setAddressErrors] = useState<AddressFieldErrors>({});
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cartQuery = useQuery({
    queryFn: getCart,
    queryKey: customerQueryKeys.cart()
  });
  const addressesQuery = useQuery({
    queryFn: listCustomerAddresses,
    queryKey: customerQueryKeys.addresses()
  });
  const createAddressMutation = useMutation(
    createCreateAddressMutation({
      mode: "prepend",
      queryClient,
      onSuccess: (address) => {
        setSelectedAddressId(address.id);
        setAddressErrors({});
        setAddressForm({
          ...emptyAddressForm,
          phone: customer?.mobileNumber ?? ""
        });
      }
    })
  );
  const createOrderMutation = useMutation(createCheckoutOrderMutation());
  const createRazorpayOrderMutation = useMutation(
    createCheckoutRazorpayOrderMutation()
  );
  const verifyPaymentMutation = useMutation(
    createCheckoutPaymentVerificationMutation()
  );
  const cart = cartQuery.data;
  const addresses = useMemo(
    () => addressesQuery.data ?? [],
    [addressesQuery.data]
  );
  const selectedAddress =
    addresses.find((address) => address.id === selectedAddressId) ?? null;
  const hasBlockingStockIssue =
    cart?.items.some((item) => !item.isAvailable || item.quantity > item.availableQuantity) ??
    false;

  useEffect(() => {
    if (cart) {
      setCartSummary(cart);
    }
  }, [cart, setCartSummary]);

  useEffect(() => {
    if (customer?.mobileNumber && addressForm.phone.length === 0) {
      setAddressForm((current) => ({
        ...current,
        phone: customer.mobileNumber
      }));
    }
  }, [addressForm.phone.length, customer?.mobileNumber]);

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) {
      return;
    }

    setSelectedAddressId(
      addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null
    );
  }, [addresses, selectedAddressId]);

  function applyEmptyCart() {
    resetCartSummary();
    queryClient.setQueryData<Cart | undefined>(customerQueryKeys.cart(), (existing) =>
      existing
        ? {
            ...existing,
            itemCount: 0,
            items: [],
            totalQuantity: 0,
            totals: {
              deliveryCharge: 0,
              discount: 0,
              grandTotal: 0,
              subtotal: 0,
              tax: 0
            }
          }
        : existing
    );
  }

  async function handleAddAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedInput = normalizeAddressForm(addressForm);
    const parsedInput =
      createCustomerAddressInputSchema.safeParse(normalizedInput);

    if (!parsedInput.success) {
      setAddressErrors(toFieldErrors(parsedInput.error.flatten().fieldErrors));
      return;
    }

    try {
      await createAddressMutation.mutateAsync(parsedInput.data);
    } catch (error) {
      setSubmitError(
        getFriendlyApiErrorMessage(error, "Unable to save address.")
      );
    }
  }

  async function handlePlaceOrder() {
    if (processingRef.current) {
      return;
    }

    const validationError = getCheckoutSubmissionError({
      cartHasItems: Boolean(cart && cart.items.length > 0),
      hasBlockingStockIssue,
      selectedAddressId
    });

    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    if (!selectedAddressId) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setSubmitError(null);

    try {
      const order = await createOrderMutation.mutateAsync({
        billingAddressId: null,
        paymentMethod,
        shippingAddressId: selectedAddressId
      });

      if (paymentMethod === "COD") {
        applyEmptyCart();
        router.replace(`/order-success/${order.id}`);
        return;
      }

      const razorpayOrder = await createRazorpayOrderMutation.mutateAsync(order.id);
      const paymentResponse = await openRazorpayCheckout({
        amount: razorpayOrder.razorpay.amount,
        contact: selectedAddress?.phone ?? customer?.mobileNumber,
        currency: razorpayOrder.razorpay.currency,
        description: order.orderNumber,
        key: razorpayOrder.razorpay.keyId,
        name: "Surgical Medical Equipment",
        orderId: razorpayOrder.razorpay.orderId,
        prefillName: selectedAddress?.fullName ?? customer?.firstName
      });

      await verifyPaymentMutation.mutateAsync({
        orderId: order.id,
        ...paymentResponse
      });
      applyEmptyCart();
      router.replace(`/order-success/${order.id}`);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const message = getFriendlyApiErrorMessage(error, "Unable to place order.");

      if (
        paymentMethod === "ONLINE" &&
        `${rawMessage} ${message}`.toLowerCase().includes("payment")
      ) {
        router.replace(`/payment-failed?reason=${encodeURIComponent(message)}`);
        return;
      }

      setSubmitError(message);
      processingRef.current = false;
      setIsProcessing(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-xs font-extrabold uppercase text-[#9b6a1e]">
          Secure checkout
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#17211f]">
          Checkout
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687773]">
          Select delivery details, confirm payment, and place your order.
        </p>
      </div>

              {cartQuery.isLoading || addressesQuery.isLoading ? (
                <SectionLoader label="Loading checkout" />
              ) : null}

              {cartQuery.isError ? (
                <ErrorState
                  action={<RetryButton onRetry={() => cartQuery.refetch()} />}
                  message={getFriendlyApiErrorMessage(
                    cartQuery.error,
                    "Unable to load cart."
                  )}
                  title="Unable to load cart"
                />
              ) : null}

              {addressesQuery.isError ? (
                <ErrorState
                  action={<RetryButton onRetry={() => addressesQuery.refetch()} />}
                  message={getFriendlyApiErrorMessage(
                    addressesQuery.error,
                    "Unable to load delivery addresses."
                  )}
                  title="Unable to load addresses"
                />
              ) : null}

              {cart && cart.items.length === 0 ? (
                <EmptyState
                  action={<Button href="/products">Continue shopping</Button>}
                  description="Your cart is empty. Add items before checkout."
                  title="No items to checkout"
                />
              ) : null}

              {cart && cart.items.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                  <div className="grid gap-5">
                    <AddressSelection
                      addresses={addresses}
                      selectedAddressId={selectedAddressId}
                      setSelectedAddressId={setSelectedAddressId}
                    />
                    <AddressForm
                      addressErrors={addressErrors}
                      addressForm={addressForm}
                      isSaving={createAddressMutation.isPending}
                      onChange={(field, value) =>
                        setAddressForm((current) => ({
                          ...current,
                          [field]: value
                        }))
                      }
                      onSubmit={handleAddAddress}
                    />
                    <PaymentMethodSelection
                      paymentMethod={paymentMethod}
                      setPaymentMethod={setPaymentMethod}
                    />
                  </div>

                  <OrderConfirmation
                    cart={cart}
                    hasBlockingStockIssue={hasBlockingStockIssue}
                    isProcessing={isProcessing}
                    paymentMethod={paymentMethod}
                    selectedAddress={selectedAddress}
                    submitError={submitError}
                    onPlaceOrder={handlePlaceOrder}
                  />
                </div>
              ) : null}
    </section>
  );
}

function AddressSelection({
  addresses,
  selectedAddressId,
  setSelectedAddressId
}: {
  addresses: CustomerAddress[];
  selectedAddressId: string | null;
  setSelectedAddressId: (addressId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#d8e2df] bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <MapPin aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#17211f]">
            Delivery address
          </h2>
          <p className="text-sm font-bold text-[#687773]">
            Choose a saved address or add a new one.
          </p>
        </div>
      </div>

      {addresses.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            description="Address missing. Add a delivery address below before placing this order."
            title="No saved addresses yet"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {addresses.map((address) => (
            <label
              className="flex min-h-16 cursor-pointer gap-3 rounded-lg border border-[#d8e2df] bg-[#f8fbfa] p-4 data-[checked=true]:border-[#006d77] data-[checked=true]:bg-[#e7f3f2]"
              data-checked={selectedAddressId === address.id}
              key={address.id}
            >
              <input
                checked={selectedAddressId === address.id}
                className="mt-1 h-5 w-5 shrink-0 accent-[#006d77]"
                name="shippingAddress"
                onChange={() => setSelectedAddressId(address.id)}
                type="radio"
              />
              <span>
                <strong className="block text-[#17211f]">
                  {address.fullName}{" "}
                  {address.isDefault ? (
                    <span className="text-xs text-[#006d77]">Default</span>
                  ) : null}
                </strong>
                <span className="mt-1 block text-sm font-bold leading-6 text-[#687773]">
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ""},{" "}
                  {address.city}, {address.state} {address.pincode}
                </span>
                <span className="text-sm font-bold text-[#687773]">
                  {address.phone}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

function AddressForm({
  addressErrors,
  addressForm,
  isSaving,
  onChange,
  onSubmit
}: {
  addressErrors: AddressFieldErrors;
  addressForm: CreateCustomerAddressInput;
  isSaving: boolean;
  onChange: (
    field: keyof CreateCustomerAddressInput,
    value: CreateCustomerAddressInput[keyof CreateCustomerAddressInput]
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="rounded-lg border border-[#d8e2df] bg-white p-5"
      onSubmit={onSubmit}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eef3f1] text-[#31413d]">
          <Plus aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#17211f]">
            Add new address
          </h2>
          <p className="text-sm font-bold text-[#687773]">
            Saved addresses are available for future checkouts.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input
          error={addressErrors.fullName}
          label="Full name"
          name="fullName"
          onChange={(event) => onChange("fullName", event.target.value)}
          value={addressForm.fullName}
        />
        <Input
          error={addressErrors.phone}
          label="Phone"
          name="phone"
          onChange={(event) => onChange("phone", event.target.value)}
          placeholder="+919876543210"
          value={addressForm.phone}
        />
        <Input
          className="md:col-span-2"
          error={addressErrors.addressLine1}
          label="Address line 1"
          name="addressLine1"
          onChange={(event) => onChange("addressLine1", event.target.value)}
          value={addressForm.addressLine1}
        />
        <Input
          error={addressErrors.addressLine2}
          label="Address line 2"
          name="addressLine2"
          onChange={(event) => onChange("addressLine2", event.target.value)}
          value={addressForm.addressLine2 ?? ""}
        />
        <Input
          error={addressErrors.landmark}
          label="Landmark"
          name="landmark"
          onChange={(event) => onChange("landmark", event.target.value)}
          value={addressForm.landmark ?? ""}
        />
        <Input
          error={addressErrors.city}
          label="City"
          name="city"
          onChange={(event) => onChange("city", event.target.value)}
          value={addressForm.city}
        />
        <Input
          error={addressErrors.state}
          label="State"
          name="state"
          onChange={(event) => onChange("state", event.target.value)}
          value={addressForm.state}
        />
        <Input
          error={addressErrors.pincode}
          label="Pincode"
          name="pincode"
          onChange={(event) => onChange("pincode", event.target.value)}
          value={addressForm.pincode}
        />
        <label className="grid gap-2 text-sm font-bold text-[#31413d]">
          <span>Address type</span>
          <select
            className="min-h-12 rounded-lg border border-[#cfdcda] bg-white px-4 text-base text-[#17211f] outline-none transition focus:border-[#006d77] focus:ring-2 focus:ring-[#006d77]/20"
            onChange={(event) =>
              onChange(
                "type",
                event.target.value as CreateCustomerAddressInput["type"]
              )
            }
            value={addressForm.type}
          >
            <option value="CLINIC">Clinic</option>
            <option value="HOSPITAL">Hospital</option>
            <option value="WORK">Work</option>
            <option value="HOME">Home</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>

      <div className="mt-5">
        <Button className="w-full sm:w-auto" disabled={isSaving} type="submit" variant="outline">
          <Plus aria-hidden="true" className="h-4 w-4" />
          {isSaving ? "Saving address..." : "Save address"}
        </Button>
      </div>
    </form>
  );
}

function PaymentMethodSelection({
  paymentMethod,
  setPaymentMethod
}: {
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
}) {
  return (
    <section className="rounded-lg border border-[#d8e2df] bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <CreditCard aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#17211f]">
            Payment method
          </h2>
          <p className="text-sm font-bold text-[#687773]">
            Choose COD or online Razorpay payment.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["COD", "ONLINE"] as const).map((method) => (
          <button
            className="min-h-24 rounded-lg border border-[#d8e2df] bg-[#f8fbfa] p-4 text-left data-[checked=true]:border-[#006d77] data-[checked=true]:bg-[#e7f3f2]"
            data-checked={paymentMethod === method}
            key={method}
            onClick={() => setPaymentMethod(method)}
            type="button"
          >
            <span className="font-extrabold text-[#17211f]">
              {method === "COD" ? "Cash on delivery" : "Online payment"}
            </span>
            <span className="mt-1 block text-sm font-bold text-[#687773]">
              {method === "COD"
                ? "Pay when the order is delivered."
                : "Pay securely with Razorpay checkout."}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function OrderConfirmation({
  cart,
  hasBlockingStockIssue,
  isProcessing,
  onPlaceOrder,
  paymentMethod,
  selectedAddress,
  submitError
}: {
  cart: Cart;
  hasBlockingStockIssue: boolean;
  isProcessing: boolean;
  onPlaceOrder: () => void;
  paymentMethod: PaymentMethod;
  selectedAddress: CustomerAddress | null;
  submitError: string | null;
}) {
  return (
    <aside className="h-fit rounded-lg border border-[#d8e2df] bg-white p-5 lg:sticky lg:top-28">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#17211f]">
            Confirm order
          </h2>
          <p className="text-sm font-bold text-[#687773]">
            Review before final submit.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-[#f8fbfa] p-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[#17211f]">
          <Truck aria-hidden="true" className="h-4 w-4 text-[#006d77]" />
          Delivery
        </div>
        {selectedAddress ? (
          <p className="mt-2 text-sm font-bold leading-6 text-[#687773]">
            {selectedAddress.fullName}, {selectedAddress.addressLine1},{" "}
            {selectedAddress.city}, {selectedAddress.state}{" "}
            {selectedAddress.pincode}
          </p>
        ) : (
          <p className="mt-2 text-sm font-bold text-[#b42318]">
            Select a delivery address.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-2 text-sm text-[#31413d]">
        <SummaryRow label="Subtotal" value={cart.totals.subtotal} />
        <SummaryRow
          label="Discount"
          value={cart.totals.discount > 0 ? -cart.totals.discount : 0}
        />
        <SummaryRow label="Delivery charge" value={cart.totals.deliveryCharge} />
        <SummaryRow label="Tax/GST" value={cart.totals.tax} />
        <div className="mt-2 flex items-center justify-between border-t border-[#d8e2df] pt-4 text-base font-extrabold text-[#17211f]">
          <span>Grand total</span>
          <span>{priceFormatter.format(cart.totals.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-[#f8fbfa] px-4 py-3 text-sm font-bold text-[#687773]">
        Payment: {paymentMethod === "COD" ? "Cash on delivery" : "Online"}
      </div>

      {hasBlockingStockIssue ? (
        <p className="mt-4 rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]">
          {stockErrorMessage()}
        </p>
      ) : null}

      {submitError ? (
        <p className="mt-4 rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]">
          {submitError}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3">
        <Button className="w-full" disabled={isProcessing} onClick={onPlaceOrder}>
          {isProcessing
            ? "Processing..."
            : paymentMethod === "ONLINE"
              ? "Place order and pay"
              : "Place COD order"}
        </Button>
        <Button className="w-full" href="/cart" variant="outline">
          Back to cart
        </Button>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <strong>{priceFormatter.format(value)}</strong>
    </div>
  );
}

function normalizeAddressForm(input: CreateCustomerAddressInput) {
  return {
    ...input,
    addressLine2: input.addressLine2?.trim() ? input.addressLine2 : null,
    landmark: input.landmark?.trim() ? input.landmark : null
  };
}

function toFieldErrors(
  errors: Record<string, string[] | undefined>
): AddressFieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, messages?.[0]])
  ) as AddressFieldErrors;
}
