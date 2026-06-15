"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Edit3,
  MapPin,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCart, type Cart, type CartItem } from "../../lib/api/cart";
import {
  getFriendlyApiErrorMessage,
  stockErrorMessage
} from "../../lib/api/error-messages";
import {
  createCustomerAddressInputSchema,
  listCustomerAddresses,
  type CreateCustomerAddressInput,
  type CustomerAddress,
  type CustomerAddressType
} from "../../lib/api/customer-profile";
import {
  createCheckoutOrderMutation,
  createCheckoutPaymentVerificationMutation,
  createCheckoutRazorpayOrderMutation,
  createCreateAddressMutation,
  createUpdateAddressMutation
} from "../../lib/api/mutation-helpers";
import { type PaymentMethod } from "../../lib/api/orders";
import { getPaymentGatewayStatus } from "../../lib/api/payments";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { getCheckoutSubmissionError } from "../../lib/checkout/checkout-validation";
import { openRazorpayCheckout } from "../../lib/checkout/razorpay";
import { getProductImageAlt } from "../../lib/seo/metadata";
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

type AddressFieldErrors = Partial<Record<keyof CreateCustomerAddressInput, string>>;
type AddressFormMode =
  | { type: "closed" }
  | { type: "create" }
  | { address: CustomerAddress; type: "edit" };

const addressTypeOptions: Array<{
  label: string;
  value: CustomerAddressType;
}> = [
  { label: "Clinic", value: "CLINIC" },
  { label: "Hospital", value: "HOSPITAL" },
  { label: "Work", value: "WORK" },
  { label: "Home", value: "HOME" },
  { label: "Other", value: "OTHER" }
];

export function CheckoutPage() {
  return (
    <>
      <Header />
      <main className="bg-[#f4f9ff]">
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
  const [addressFormMode, setAddressFormMode] =
    useState<AddressFormMode>({ type: "closed" });
  const [addressForm, setAddressForm] =
    useState<CreateCustomerAddressInput>(emptyAddressForm);
  const [addressErrors, setAddressErrors] = useState<AddressFieldErrors>({});
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [addressMutationError, setAddressMutationError] = useState<string | null>(
    null
  );
  const [addressSuccessMessage, setAddressSuccessMessage] = useState<string | null>(
    null
  );
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
  const paymentGatewayQuery = useQuery({
    queryFn: getPaymentGatewayStatus,
    queryKey: customerQueryKeys.paymentGatewayStatus()
  });
  const createAddressMutation = useMutation(
    createCreateAddressMutation({
      mode: "prepend",
      queryClient,
      onSuccess: (address) => {
        setSelectedAddressId(address.id);
        closeAddressForm();
        setAddressSuccessMessage("Address saved and selected.");
      }
    })
  );
  const updateAddressMutation = useMutation(
    createUpdateAddressMutation({
      queryClient,
      onSuccess: (address) => {
        setSelectedAddressId(address.id);
        closeAddressForm();
        setAddressSuccessMessage("Address updated.");
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
  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const selectedAddress =
    addresses.find((address) => address.id === selectedAddressId) ?? null;
  const hasBlockingStockIssue =
    cart?.items.some(
      (item) => !item.isAvailable || item.quantity > item.availableQuantity
    ) ?? false;
  const onlinePaymentEnabled =
    paymentGatewayQuery.data?.onlinePaymentEnabled === true;
  const onlinePaymentMessage =
    paymentGatewayQuery.data?.message ??
    "Online payments are currently unavailable. Please choose Cash on Delivery or try again later.";
  const addressIsSaving =
    createAddressMutation.isPending || updateAddressMutation.isPending;

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

  useEffect(() => {
    if (
      paymentMethod === "ONLINE" &&
      !onlinePaymentEnabled &&
      !paymentGatewayQuery.isLoading
    ) {
      setPaymentMethod("COD");
    }
  }, [onlinePaymentEnabled, paymentGatewayQuery.isLoading, paymentMethod]);

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

  function openCreateAddressForm() {
    setAddressForm({
      ...emptyAddressForm,
      phone: customer?.mobileNumber ?? ""
    });
    setAddressErrors({});
    setAddressMutationError(null);
    setAddressSuccessMessage(null);
    setAddressFormMode({ type: "create" });
  }

  function openEditAddressForm(address: CustomerAddress) {
    setAddressForm({
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      fullName: address.fullName,
      landmark: address.landmark,
      phone: address.phone,
      pincode: address.pincode,
      state: address.state,
      type: address.type
    });
    setAddressErrors({});
    setAddressMutationError(null);
    setAddressSuccessMessage(null);
    setAddressFormMode({ address, type: "edit" });
  }

  function closeAddressForm() {
    setAddressForm({
      ...emptyAddressForm,
      phone: customer?.mobileNumber ?? ""
    });
    setAddressErrors({});
    setAddressMutationError(null);
    setAddressFormMode({ type: "closed" });
  }

  async function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedInput = normalizeAddressForm(addressForm);
    const parsedInput = createCustomerAddressInputSchema.safeParse(normalizedInput);

    if (!parsedInput.success) {
      setAddressErrors(toFieldErrors(parsedInput.error.flatten().fieldErrors));
      return;
    }

    try {
      setAddressMutationError(null);
      setAddressSuccessMessage(null);

      if (addressFormMode.type === "edit") {
        await updateAddressMutation.mutateAsync({
          addressId: addressFormMode.address.id,
          input: parsedInput.data
        });
        return;
      }

      await createAddressMutation.mutateAsync(parsedInput.data);
    } catch (error) {
      setAddressMutationError(
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

    if (paymentMethod === "ONLINE" && !onlinePaymentEnabled) {
      setSubmitError(onlinePaymentMessage);
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
      const message = getFriendlyApiErrorMessage(error, "Unable to place order.");

      setSubmitError(message);
      processingRef.current = false;
      setIsProcessing(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-[#12314f] sm:text-3xl">
              Checkout
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#52677f]">
              Review cart items, choose delivery, confirm payment, and place the order.
            </p>
          </div>
          {cart ? (
            <div className="rounded-lg border border-[#d6e7f8] bg-[#f4f9ff] px-4 py-3 shadow-sm shadow-[#0b5cab]/5">
              <p className="text-xs font-bold uppercase text-[#52677f]">
                Amount payable
              </p>
              <p className="mt-1 text-xl font-bold text-[#12314f]">
                {priceFormatter.format(cart.totals.grandTotal)}
              </p>
            </div>
          ) : null}
        </div>
        <CheckoutStepStrip
          hasAddress={Boolean(selectedAddressId)}
          hasItems={Boolean(cart && cart.items.length > 0)}
          paymentMethod={paymentMethod}
        />
      </div>

      {cartQuery.isLoading || addressesQuery.isLoading ? (
        <SectionLoader label="Loading checkout" />
      ) : null}

      {cartQuery.isError ? (
        <ErrorState
          action={<RetryButton onRetry={() => cartQuery.refetch()} />}
          message={getFriendlyApiErrorMessage(cartQuery.error, "Unable to load cart.")}
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-5">
            <CartReview cart={cart} />
            <AddressSelection
              addressSuccessMessage={addressSuccessMessage}
              addresses={addresses}
              formMode={addressFormMode}
              mutationError={addressMutationError}
              onAddAddress={openCreateAddressForm}
              onEditAddress={openEditAddressForm}
              selectedAddressId={selectedAddressId}
              setSelectedAddressId={setSelectedAddressId}
            />
            {addressFormMode.type !== "closed" ? (
              <AddressForm
                addressErrors={addressErrors}
                addressForm={addressForm}
                formTitle={
                  addressFormMode.type === "edit"
                    ? "Edit delivery address"
                    : "Add delivery address"
                }
                isSaving={addressIsSaving}
                onCancel={closeAddressForm}
                onChange={(field, value) =>
                  setAddressForm((current) => ({
                    ...current,
                    [field]: value
                  }))
                }
                onSubmit={handleAddressSubmit}
                submitLabel={
                  addressFormMode.type === "edit" ? "Update address" : "Save address"
                }
              />
            ) : null}
            <PaymentMethodSelection
              onlinePaymentEnabled={onlinePaymentEnabled}
              onlinePaymentIsLoading={paymentGatewayQuery.isLoading}
              onlinePaymentMessage={onlinePaymentMessage}
              paymentMethod={paymentMethod}
              setPaymentMethod={(method) => {
                setPaymentMethod(method);
                setSubmitError(null);
              }}
            />
          </div>

          <OrderSummary
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

function CheckoutStepStrip({
  hasAddress,
  hasItems,
  paymentMethod
}: {
  hasAddress: boolean;
  hasItems: boolean;
  paymentMethod: PaymentMethod;
}) {
  const steps = [
    {
      active: hasItems,
      icon: Truck,
      label: "Cart review",
      value: hasItems ? "Items ready" : "Add products"
    },
    {
      active: hasAddress,
      icon: MapPin,
      label: "Delivery",
      value: hasAddress ? "Address selected" : "Select address"
    },
    {
      active: true,
      icon: CreditCard,
      label: "Payment",
      value: paymentMethod === "COD" ? "Cash on delivery" : "Online payment"
    },
    {
      active: hasItems && hasAddress,
      icon: ShieldCheck,
      label: "Confirmation",
      value: hasItems && hasAddress ? "Ready to submit" : "Needs details"
    }
  ] as const;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((step) => {
        const Icon = step.icon;

        return (
          <div
            className={[
              "flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2",
              step.active
                ? "border-[#b9d6f2] bg-[#f4f9ff]"
                : "border-[#d6e7f8] bg-white"
            ].join(" ")}
            key={step.label}
          >
            <span
              className={[
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                step.active ? "bg-white text-[#0b5cab]" : "bg-[#f4f9ff] text-[#52677f]"
              ].join(" ")}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs font-bold uppercase text-[#52677f]">
                {step.label}
              </span>
              <strong className="mt-1 block text-sm leading-5 text-[#12314f]">
                {step.value}
              </strong>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CartReview({ cart }: { cart: Cart }) {
  return (
    <section className="rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 sm:p-5">
      <SectionHeading
        description={`${cart.itemCount} product${cart.itemCount === 1 ? "" : "s"} / ${cart.totalQuantity} unit${cart.totalQuantity === 1 ? "" : "s"}`}
        icon={<ShoppingBag aria-hidden="true" className="h-5 w-5" />}
        title="Cart review"
      />

      <div className="mt-4 grid gap-3">
        {cart.items.map((item) => (
          <CheckoutCartItem key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-[#d6e7f8] pt-4 text-sm font-semibold text-[#52677f] sm:flex-row sm:items-center sm:justify-between">
        <span>Need to change quantities or remove items?</span>
        <Button className="w-full sm:w-auto" href="/cart" variant="outline">
          Back to cart
        </Button>
      </div>
    </section>
  );
}

function CheckoutCartItem({ item }: { item: CartItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const stockWarning =
    !item.isAvailable || item.quantity > item.availableQuantity;

  return (
    <article className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-[#d6e7f8] bg-[#f8fbff] p-3 shadow-sm shadow-[#0b5cab]/5 sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:items-center">
      <a
        className="relative aspect-square overflow-hidden rounded-lg border border-[#d6e7f8] bg-white shadow-sm shadow-[#0b5cab]/5"
        href={`/products/${item.slug}`}
      >
        {item.imageUrl && !imageFailed ? (
          <Image
            alt={getProductImageAlt(item.name, null)}
            className="object-cover"
            fill
            onError={() => setImageFailed(true)}
            sizes="84px"
            src={item.imageUrl}
            unoptimized
          />
        ) : (
          <span className="grid h-full place-items-center text-[#0b5cab]">
            <PackageCheck aria-hidden="true" className="h-8 w-8" />
          </span>
        )}
      </a>
      <div className="min-w-0">
        <a
          className="line-clamp-2 text-sm font-bold leading-5 text-[#12314f] hover:text-[#0b5cab] sm:text-base"
          href={`/products/${item.slug}`}
        >
          {item.name}
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-[#52677f]">
          <span>SKU {item.sku}</span>
          {item.variantName ? <span>{item.variantName}</span> : null}
          <span>Qty {item.quantity}</span>
          <span>{item.taxRate}% GST</span>
        </div>
        {stockWarning ? (
          <p className="mt-2 flex gap-2 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] px-3 py-2 text-xs font-bold leading-5 text-[#7a271a]">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            {stockErrorMessage(item.availableQuantity)}
          </p>
        ) : null}
      </div>
      <div className="col-span-2 grid grid-cols-3 gap-2 text-xs sm:col-span-1 sm:min-w-52">
        <CartLineMetric label="Unit" value={priceFormatter.format(item.unitPrice)} />
        <CartLineMetric label="Tax" value={priceFormatter.format(item.tax)} />
        <CartLineMetric label="Total" value={priceFormatter.format(item.total)} />
      </div>
    </article>
  );
}

function CartLineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d6e7f8] bg-white px-3 py-2 shadow-sm shadow-[#0b5cab]/5">
      <span className="block text-[11px] font-bold uppercase text-[#52677f]">
        {label}
      </span>
      <strong className="mt-0.5 block break-words text-xs font-bold text-[#12314f]">
        {value}
      </strong>
    </div>
  );
}

function AddressSelection({
  addressSuccessMessage,
  addresses,
  formMode,
  mutationError,
  onAddAddress,
  onEditAddress,
  selectedAddressId,
  setSelectedAddressId
}: {
  addressSuccessMessage: string | null;
  addresses: CustomerAddress[];
  formMode: AddressFormMode;
  mutationError: string | null;
  onAddAddress: () => void;
  onEditAddress: (address: CustomerAddress) => void;
  selectedAddressId: string | null;
  setSelectedAddressId: (addressId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          description="Choose a saved address or add a new one."
          icon={<MapPin aria-hidden="true" className="h-5 w-5" />}
          title="Delivery address"
        />
        <Button
          className="w-full sm:w-auto"
          disabled={formMode.type === "create"}
          onClick={onAddAddress}
          variant="outline"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add address
        </Button>
      </div>

      {addressSuccessMessage ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-[#badbcc] bg-[#effaf3] px-4 py-3 text-sm font-bold text-[#0f6b50]">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          {addressSuccessMessage}
        </p>
      ) : null}

      {mutationError ? (
        <p className="mt-4 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]">
          {mutationError}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            action={<Button onClick={onAddAddress}>Add delivery address</Button>}
            description="Add a delivery address before placing this order."
            title="No saved addresses yet"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {addresses.map((address) => (
            <div
              className="grid gap-3 rounded-lg border border-[#d6e7f8] bg-[#f8fbff] p-3 shadow-sm shadow-[#0b5cab]/5 data-[checked=true]:border-[#0b5cab] data-[checked=true]:bg-[#f4f9ff] sm:grid-cols-[1fr_auto] sm:items-start"
              data-checked={selectedAddressId === address.id}
              key={address.id}
            >
              <label className="flex cursor-pointer gap-3">
                <input
                  checked={selectedAddressId === address.id}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#0b5cab]"
                  name="shippingAddress"
                  onChange={() => setSelectedAddressId(address.id)}
                  type="radio"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-bold text-[#12314f]">
                      {address.fullName}
                    </strong>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase text-[#52677f]">
                      {formatAddressType(address.type)}
                    </span>
                    {address.isDefault ? (
                      <span className="rounded-full bg-[#dff3ef] px-2 py-0.5 text-[11px] font-bold uppercase text-[#0f6b50]">
                        Default
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm font-semibold leading-5 text-[#52677f]">
                    {formatAddress(address)}
                  </span>
                  {address.landmark ? (
                    <span className="mt-1 block text-xs font-bold text-[#52677f]">
                      Landmark: {address.landmark}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-xs font-bold text-[#52677f]">
                    {address.phone}
                  </span>
                </span>
              </label>
              <Button
                className="w-full sm:w-auto"
                disabled={
                  formMode.type === "edit" && formMode.address.id === address.id
                }
                onClick={() => onEditAddress(address)}
                variant="outline"
              >
                <Edit3 aria-hidden="true" className="h-4 w-4" />
                Edit
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AddressForm({
  addressErrors,
  addressForm,
  formTitle,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  submitLabel
}: {
  addressErrors: AddressFieldErrors;
  addressForm: CreateCustomerAddressInput;
  formTitle: string;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (
    field: keyof CreateCustomerAddressInput,
    value: CreateCustomerAddressInput[keyof CreateCustomerAddressInput]
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form
      className="grid gap-5 rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 sm:p-5"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          description="Saved addresses are available for future checkouts."
          icon={<Plus aria-hidden="true" className="h-5 w-5" />}
          title={formTitle}
        />
        <Button
          className="w-full sm:w-auto"
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
        <label className="grid gap-2 text-sm font-bold text-[#12314f]">
          <span>Address type</span>
          <select
            className="min-h-12 rounded-full border border-[#b9d6f2] bg-white px-5 text-base text-[#12314f] outline-none transition focus:border-[#0b5cab] focus:ring-2 focus:ring-[#0b5cab]/20"
            onChange={(event) =>
              onChange("type", event.target.value as CreateCustomerAddressInput["type"])
            }
            value={addressForm.type}
          >
            {addressTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <Button
          className="w-full sm:w-auto"
          disabled={isSaving}
          type="submit"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {isSaving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function PaymentMethodSelection({
  onlinePaymentEnabled,
  onlinePaymentIsLoading,
  onlinePaymentMessage,
  paymentMethod,
  setPaymentMethod
}: {
  onlinePaymentEnabled: boolean;
  onlinePaymentIsLoading: boolean;
  onlinePaymentMessage: string;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
}) {
  return (
    <section className="rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 sm:p-5">
      <SectionHeading
        description="Choose COD or online Razorpay payment."
        icon={<CreditCard aria-hidden="true" className="h-5 w-5" />}
        title="Payment method"
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["COD", "ONLINE"] as const).map((method) => {
          const isOnline = method === "ONLINE";
          const onlineDisabled =
            isOnline && (!onlinePaymentEnabled || onlinePaymentIsLoading);
          const disabledLabel = onlinePaymentIsLoading ? "Checking" : "Coming soon";

          return (
            <button
              aria-pressed={paymentMethod === method}
              className={[
                "min-h-24 rounded-lg border border-[#d6e7f8] bg-[#f8fbff] p-4 text-left shadow-sm shadow-[#0b5cab]/5 transition data-[checked=true]:border-[#0b5cab] data-[checked=true]:bg-[#f4f9ff]",
                onlineDisabled
                  ? "cursor-not-allowed opacity-75"
                  : "hover:border-[#0b5cab]"
              ].join(" ")}
              data-checked={paymentMethod === method}
              disabled={onlineDisabled}
              key={method}
              onClick={() => setPaymentMethod(method)}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-bold text-[#12314f]">
                  {method === "COD" ? "Cash on delivery" : "Online payment"}
                </span>
                {onlineDisabled ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase text-[#52677f]">
                    {disabledLabel}
                  </span>
                ) : paymentMethod === method ? (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[#0f6b50]" />
                ) : null}
              </span>
              <span className="mt-2 block text-sm font-semibold leading-5 text-[#52677f]">
                {method === "COD"
                  ? "Pay after delivery is accepted by your team."
                  : onlineDisabled
                    ? onlinePaymentMessage
                    : "Pay securely with Razorpay checkout."}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OrderSummary({
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
    <aside className="h-fit rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 xl:sticky xl:top-28">
      <SectionHeading
        description={`${cart.totalQuantity} unit${cart.totalQuantity === 1 ? "" : "s"} ready for confirmation.`}
        icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
        title="Order summary"
      />

      <div className="mt-5 rounded-lg border border-[#d6e7f8] bg-[#f8fbff] p-4 shadow-sm shadow-[#0b5cab]/5">
        <div className="flex items-center gap-2 text-sm font-bold text-[#12314f]">
          <Truck aria-hidden="true" className="h-4 w-4 text-[#0b5cab]" />
          Delivery
        </div>
        {selectedAddress ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-[#52677f]">
            {selectedAddress.fullName}, {formatAddress(selectedAddress)}
          </p>
        ) : (
          <p className="mt-2 text-sm font-bold text-[#b42318]" role="alert">
            Select a delivery address.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5">
        <p className="text-xs font-bold uppercase text-[#52677f]">
          Price details
        </p>
        <div className="mt-3 grid gap-2 text-sm text-[#31413d]">
        <SummaryRow label="Subtotal" value={cart.totals.subtotal} />
        <SummaryRow
          label="Discount"
          value={cart.totals.discount > 0 ? -cart.totals.discount : 0}
        />
        <SummaryRow label="Delivery charge" value={cart.totals.deliveryCharge} />
        <SummaryRow label="Tax/GST" value={cart.totals.tax} />
          <div className="mt-2 flex items-center justify-between border-t border-[#d6e7f8] pt-4 text-base font-bold text-[#12314f]">
            <span>Total payable</span>
            <span>{priceFormatter.format(cart.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#d6e7f8] bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-[#52677f] shadow-sm shadow-[#0b5cab]/5">
        Payment:{" "}
        <strong className="text-[#12314f]">
          {paymentMethod === "COD" ? "Cash on delivery" : "Online payment"}
        </strong>
      </div>

      {hasBlockingStockIssue ? (
        <p className="mt-4 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]" role="alert">
          {stockErrorMessage()}
        </p>
      ) : null}

      {submitError ? (
        <p className="mt-4 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]" role="alert">
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#52677f]">{label}</span>
      <strong className="text-right font-bold text-[#12314f]">
        {priceFormatter.format(value)}
      </strong>
    </div>
  );
}

function SectionHeading({
  description,
  icon,
  title
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f4f9ff] text-[#0b5cab]">
        {icon}
      </span>
      <div>
        <h2 className="text-base font-bold leading-6 text-[#12314f] sm:text-lg">
          {title}
        </h2>
        <p className="mt-0.5 text-sm font-semibold leading-5 text-[#52677f]">
          {description}
        </p>
      </div>
    </div>
  );
}

function normalizeAddressForm(input: CreateCustomerAddressInput) {
  return {
    ...input,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() ? input.addressLine2.trim() : null,
    city: input.city.trim(),
    fullName: input.fullName.trim(),
    landmark: input.landmark?.trim() ? input.landmark.trim() : null,
    phone: input.phone.trim(),
    pincode: input.pincode.trim(),
    state: input.state.trim()
  };
}

function toFieldErrors(
  errors: Record<string, string[] | undefined>
): AddressFieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, messages?.[0]])
  ) as AddressFieldErrors;
}

function formatAddress(address: CustomerAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode
  ]
    .filter(Boolean)
    .join(", ");
}

function formatAddressType(type: CustomerAddressType) {
  return type
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());
}
