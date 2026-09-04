import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import type { CouponValidation } from "../../lib/api/coupons";
import type { CustomerAddress } from "../../lib/api/customer-profile";
import type { Order } from "../../lib/api/orders";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { CheckoutPage } from "./checkout-page";

const mocks = vi.hoisted(() => ({
  createCustomerAddress: vi.fn(),
  createOrder: vi.fn(),
  createRazorpayOrder: vi.fn(),
  getPaymentGatewayStatus: vi.fn(),
  getCart: vi.fn(),
  listCustomerAddresses: vi.fn(),
  listAvailableCoupons: vi.fn(),
  openRazorpayCheckout: vi.fn(),
  routerReplace: vi.fn(),
  validateCoupon: vi.fn(),
  verifyRazorpayPayment: vi.fn(),
  updateCustomerAddress: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/checkout",
  useRouter: () => ({
    replace: mocks.routerReplace
  })
}));

vi.mock("../auth/protected-customer-route", () => ({
  ProtectedCustomerRoute: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("../layout/header", () => ({
  Header: () => <header data-testid="header" />
}));

vi.mock("../layout/footer", () => ({
  Footer: () => <footer data-testid="footer" />
}));

vi.mock("../../lib/api/cart", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/api/cart")>("../../lib/api/cart");

  return {
    ...actual,
    getCart: mocks.getCart
  };
});

vi.mock("../../lib/api/customer-profile", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/customer-profile")>(
    "../../lib/api/customer-profile"
  );

  return {
    ...actual,
    createCustomerAddress: mocks.createCustomerAddress,
    listCustomerAddresses: mocks.listCustomerAddresses,
    updateCustomerAddress: mocks.updateCustomerAddress
  };
});

vi.mock("../../lib/api/coupons", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/coupons")>(
    "../../lib/api/coupons"
  );

  return {
    ...actual,
    listAvailableCoupons: mocks.listAvailableCoupons,
    validateCoupon: mocks.validateCoupon
  };
});

vi.mock("../../lib/api/orders", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/api/orders")>(
      "../../lib/api/orders"
    );

  return {
    ...actual,
    createOrder: mocks.createOrder
  };
});

vi.mock("../../lib/api/payments", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/payments")>(
    "../../lib/api/payments"
  );

  return {
    ...actual,
    createRazorpayOrder: mocks.createRazorpayOrder,
    getPaymentGatewayStatus: mocks.getPaymentGatewayStatus,
    verifyRazorpayPayment: mocks.verifyRazorpayPayment
  };
});

vi.mock("../../lib/checkout/razorpay", () => ({
  openRazorpayCheckout: mocks.openRazorpayCheckout
}));

const address: CustomerAddress = {
  addressLine1: "12 Surgical Street",
  addressLine2: "Suite 4",
  city: "Mumbai",
  createdAt: "2026-06-01T00:00:00.000Z",
  fullName: "Asha Clinic",
  id: "address_1",
  isDefault: true,
  landmark: "Near metro",
  latitude: null,
  longitude: null,
  phone: "+919876543210",
  pincode: "400001",
  state: "Maharashtra",
  type: "CLINIC",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

const cart: Cart = {
  id: "cart_1",
  itemCount: 1,
  items: [
    {
      availableQuantity: 8,
      brand: {
        id: "brand_1",
        name: "SurgiPro",
        slug: "surgipro"
      },
      category: {
        id: "category_1",
        name: "Surgical Instruments",
        slug: "surgical-instruments"
      },
      createdAt: "2026-06-01T00:00:00.000Z",
      id: "cart_item_1",
      imageUrl: "http://localhost:4000/uploads/catalog/products/images/forceps.png",
      isAvailable: true,
      name: "SurgiPro Artery Forceps",
      productId: "product_1",
      productStatus: "ACTIVE",
      quantity: 2,
      sku: "SP-FOR-10",
      slug: "surgipro-artery-forceps",
      subcategory: {
        id: "subcategory_1",
        name: "Forceps",
        slug: "forceps"
      },
      subtotal: 1000,
      tax: 180,
      taxRate: 18,
      total: 1180,
      unitPrice: 500,
      updatedAt: "2026-06-01T00:00:00.000Z",
      variantId: "variant_1",
      variantName: "Box of 10",
      variantStatus: "ACTIVE"
    }
  ],
  totalQuantity: 2,
  totals: {
    deliveryCharge: 50,
    discount: 20,
    grandTotal: 1210,
    subtotal: 1000,
    tax: 180
  },
  updatedAt: "2026-06-01T00:00:00.000Z"
};

const order: Order = {
  createdAt: "2026-06-01T00:00:00.000Z",
  deliveryTracking: [],
  id: "order_1",
  items: [],
  orderNumber: "ORD-20260601-ABC12345",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  placedAt: "2026-06-01T00:00:00.000Z",
  refunds: [],
  shippingAddress: null,
  status: "CREATED",
  statusHistory: [],
  totals: cart.totals,
  updatedAt: "2026-06-01T00:00:00.000Z",
  warehouseId: null
};

describe("CheckoutPage", () => {
  const asyncUiTimeout = { timeout: 5000 };

  beforeEach(() => {
    mocks.createCustomerAddress.mockReset();
    mocks.createOrder.mockReset();
    mocks.createRazorpayOrder.mockReset();
    mocks.getPaymentGatewayStatus.mockReset();
    mocks.getCart.mockReset();
    mocks.listCustomerAddresses.mockReset();
    mocks.listAvailableCoupons.mockReset();
    mocks.openRazorpayCheckout.mockReset();
    mocks.routerReplace.mockReset();
    mocks.validateCoupon.mockReset();
    mocks.verifyRazorpayPayment.mockReset();
    mocks.updateCustomerAddress.mockReset();
    mocks.getCart.mockResolvedValue(cart);
    mocks.listCustomerAddresses.mockResolvedValue([address]);
    mocks.listAvailableCoupons.mockResolvedValue({ items: [] });
    mocks.createOrder.mockResolvedValue(order);
    mocks.createRazorpayOrder.mockResolvedValue({
      orderId: "order_1",
      paymentId: "payment_1",
      razorpay: {
        amount: 121000,
        currency: "INR",
        keyId: "rzp_test_key",
        orderId: "order_razorpay_1"
      }
    });
    mocks.getPaymentGatewayStatus.mockResolvedValue({
      message: "Payment gateway is not configured yet.",
      onlinePaymentEnabled: false,
      provider: "razorpay"
    });
    mocks.openRazorpayCheckout.mockResolvedValue({
      razorpay_order_id: "order_razorpay_1",
      razorpay_payment_id: "pay_razorpay_1",
      razorpay_signature: "signature_1"
    });
    mocks.verifyRazorpayPayment.mockResolvedValue({
      orderStatus: "CONFIRMED",
      paymentId: "payment_1",
      paymentStatus: "PAID"
    });
    mocks.validateCoupon.mockResolvedValue({
      code: "SURGICAL10",
      discount: 40,
      grandTotal: 1170,
      message: "Coupon applied.",
      subtotal: 1000,
      tax: 180
    });
  });

  it("removes visual shadows from checkout page surfaces", async () => {
    renderCheckout();

    expect(await screen.findByTestId("checkout-main")).toHaveClass(
      "checkoutNoShadows"
    );
  });

  it("does not render the checkout progress step strip", async () => {
    renderCheckout();

    expect(
      await screen.findByRole("heading", { name: "Checkout" }, asyncUiTimeout)
    ).toBeInTheDocument();
    expect(screen.queryByText("Items ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Address selected")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready to submit")).not.toBeInTheDocument();
  });

  it("renders dynamic cart totals and validates required address fields", async () => {
    mocks.listCustomerAddresses.mockResolvedValue([]);

    renderCheckout();

    expect(
      await screen.findByRole(
        "heading",
        { name: "Cart review" },
        asyncUiTimeout
      )
    ).toBeInTheDocument();
    expect(screen.getByText("SurgiPro Artery Forceps")).toBeInTheDocument();
    expect(
      screen.getByAltText("SurgiPro Artery Forceps product image")
    ).toHaveAttribute("src", cart.items[0]?.imageUrl);
    expect(screen.getByText("Amount payable")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,210.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add address" }));
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));

    expect(
      await screen.findByText("Full name is required.", undefined, asyncUiTimeout)
    ).toBeInTheDocument();
    expect(screen.getByText("Address line 1 is required.")).toBeInTheDocument();
    expect(screen.getByText("City is required.")).toBeInTheDocument();
    expect(screen.getByText("State is required.")).toBeInTheDocument();
    expect(screen.getByText("Enter a 6 digit pincode.")).toBeInTheDocument();
    expect(
      screen.getByText("Use an E.164 phone number, for example +919876543210.")
    ).toBeInTheDocument();
  });

  it("edits a saved checkout address through the inline form", async () => {
    mocks.updateCustomerAddress.mockResolvedValue({
      ...address,
      city: "Pune"
    });

    renderCheckout();

    expect(
      await screen.findByText("Asha Clinic", undefined, asyncUiTimeout)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("City"), {
      target: {
        value: "Pune"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update address" }));

    await waitFor(() => {
      expect(mocks.updateCustomerAddress).toHaveBeenCalledWith("address_1", {
        addressLine1: "12 Surgical Street",
        addressLine2: "Suite 4",
        city: "Pune",
        fullName: "Asha Clinic",
        landmark: "Near metro",
        phone: "+919876543210",
        pincode: "400001",
        state: "Maharashtra",
        type: "CLINIC"
      });
    });
    expect(
      await screen.findByText("Address updated.", undefined, asyncUiTimeout)
    ).toBeInTheDocument();
  });

  it("waits for the selected address delivery quote before enabling checkout", async () => {
    const secondAddress = { ...address, id: "address_2", isDefault: false, pincode: "110001" };
    let resolveQuote!: (value: Cart) => void;
    const pendingQuote = new Promise<Cart>((resolve) => { resolveQuote = resolve; });
    mocks.listCustomerAddresses.mockResolvedValue([address, secondAddress]);
    mocks.getCart.mockImplementation((id) => id === secondAddress.id ? pendingQuote : Promise.resolve(cart));
    renderCheckout();

    const placeOrder = await screen.findByRole("button", { name: "Place COD order" });
    await waitFor(() => expect(placeOrder).toBeEnabled());
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    await waitFor(() => expect(mocks.getCart).toHaveBeenCalledWith(secondAddress.id));
    expect(placeOrder).toBeDisabled();
    fireEvent.click(placeOrder);
    expect(mocks.createOrder).not.toHaveBeenCalled();

    await act(async () => resolveQuote({ ...cart, totals: { ...cart.totals, deliveryCharge: 150, grandTotal: 1310 } }));
    await waitFor(() => expect(placeOrder).toBeEnabled());
    expect(screen.getByText("₹150.00")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,310.00")).toHaveLength(2);
  });

  it("recalculates delivery after the selected address pincode is edited without changing its ID", async () => {
    let resolveQuote!: (value: Cart) => void;
    const pendingQuote = new Promise<Cart>((resolve) => { resolveQuote = resolve; });
    const editedAddress = { ...address, pincode: "110001" };
    mocks.updateCustomerAddress.mockImplementation(async () => {
      mocks.listCustomerAddresses.mockResolvedValue([editedAddress]);
      mocks.getCart.mockImplementation(() => pendingQuote);
      return editedAddress;
    });
    renderCheckout();
    const placeOrder = await screen.findByRole("button", { name: "Place COD order" });
    await waitFor(() => expect(placeOrder).toBeEnabled());
    const previousQuoteCalls = mocks.getCart.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Pincode"), { target: { value: "110001" } });
    fireEvent.click(screen.getByRole("button", { name: "Update address" }));
    await screen.findByText("Address updated.");
    await waitFor(() => expect(mocks.getCart.mock.calls.length).toBeGreaterThan(previousQuoteCalls));
    expect(mocks.getCart).toHaveBeenLastCalledWith(address.id);
    expect(placeOrder).toBeDisabled();

    await act(async () => resolveQuote({ ...cart, totals: { ...cart.totals, deliveryCharge: 100, grandTotal: 1260 } }));
    await waitFor(() => expect(placeOrder).toBeEnabled());
    expect(screen.getByText("₹100.00")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,260.00")).toHaveLength(2);
  });

  it("applies a promo code once in both payable totals and sends it with checkout", async () => {
    renderCheckout();

    fireEvent.change(
      await screen.findByLabelText("Promo code", undefined, asyncUiTimeout),
      {
        target: { value: "surgical10" }
      }
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(
      await screen.findByText("Coupon applied.", undefined, asyncUiTimeout)
    ).toBeInTheDocument();
    expect(screen.getAllByText("₹1,190.00")).toHaveLength(2);
    await waitFor(() => expect(screen.getByRole("button", { name: "Place COD order" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Place COD order" }));

    await waitFor(() => {
      expect(mocks.createOrder).toHaveBeenCalledWith({
        billingAddressId: null,
        couponCode: "SURGICAL10",
        paymentMethod: "COD",
        shippingAddressId: "address_1"
      });
    });
  });

  it("places a COD order with selected address and cart totals", async () => {
    renderCheckout();

    expect(
      await screen.findByText("Asha Clinic", undefined, asyncUiTimeout)
    ).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Place COD order" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Place COD order" }));

    await waitFor(() => {
      expect(mocks.createOrder).toHaveBeenCalledWith({
        billingAddressId: null,
        couponCode: null,
        paymentMethod: "COD",
        shippingAddressId: "address_1"
      });
    });
    expect(mocks.routerReplace).toHaveBeenCalledWith("/order-success/order_1");
  });

  it("waits for coupon validation before permitting an order", async () => {
    let resolveCoupon!: (value: CouponValidation) => void;
    mocks.validateCoupon.mockImplementation(() => new Promise<CouponValidation>((resolve) => {
      resolveCoupon = resolve;
    }));
    renderCheckout();
    const placeOrder = await screen.findByRole("button", { name: "Place COD order" });
    await waitFor(() => expect(placeOrder).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Promo code"), { target: { value: "SURGICAL10" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(placeOrder).toBeDisabled();
    expect(screen.getByLabelText("Promo code")).toBeDisabled();
    fireEvent.click(placeOrder);
    expect(mocks.createOrder).not.toHaveBeenCalled();

    await waitFor(() => expect(mocks.validateCoupon).toHaveBeenCalledTimes(1));

    await act(async () => resolveCoupon({ code: "SURGICAL10", discount: 100, grandTotal: 1080, message: "Coupon applied.", subtotal: 1000, tax: 180 }));
    await waitFor(() => expect(placeOrder).toBeEnabled());
    expect(screen.getAllByText("₹1,130.00")).toHaveLength(2);
    fireEvent.click(placeOrder);
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ couponCode: "SURGICAL10" })));
  });

  it("applies an available coupon without requiring the customer to type its code", async () => {
    mocks.listAvailableCoupons.mockResolvedValue({
      items: [{ code: "SURGICAL10", type: "PERCENTAGE", value: 10, minOrderAmount: 500, maxDiscount: 40, expiresAt: null }]
    });
    renderCheckout();
    const applyOffer = await screen.findByRole("button", { name: "Apply SURGICAL10" });
    await waitFor(() => expect(applyOffer).toBeEnabled());
    fireEvent.click(applyOffer);

    expect(await screen.findByText("Coupon applied.")).toBeInTheDocument();
    expect(mocks.validateCoupon).toHaveBeenCalledWith("SURGICAL10");
    expect(screen.getByLabelText("Promo code")).toHaveValue("SURGICAL10");
    expect(screen.getByRole("button", { name: "SURGICAL10 applied" })).toBeDisabled();
    expect(screen.getAllByText("₹1,190.00")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Place COD order" }));
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ couponCode: "SURGICAL10" })));
  });

  it("shows invalid coupon errors without applying a discount or sending the invalid code", async () => {
    mocks.validateCoupon.mockRejectedValue(new Error("Coupon is not active."));
    renderCheckout();
    fireEvent.change(await screen.findByLabelText("Promo code"), { target: { value: "INACTIVE" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Coupon is not active.")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,210.00")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Place COD order" }));
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ couponCode: null })));
  });

  it("removes a coupon and restores the cart total before checkout", async () => {
    renderCheckout();
    fireEvent.change(await screen.findByLabelText("Promo code"), { target: { value: "SURGICAL10" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    expect(screen.getByLabelText("Promo code")).toHaveValue("");
    expect(screen.getAllByText("₹1,210.00")).toHaveLength(2);
    expect(screen.queryByText("Coupon applied.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Place COD order" }));
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ couponCode: null })));
  });

  it("requires a fresh coupon validation after a cart price change and supports removing a stale coupon", async () => {
    const { queryClient } = renderCheckout();
    fireEvent.change(await screen.findByLabelText("Promo code"), { target: { value: "SURGICAL10" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Coupon applied.");
    mocks.getCart.mockResolvedValue({ ...cart, items: [{ ...cart.items[0], unitPrice: 250, subtotal: 500, tax: 90 }], totals: { ...cart.totals, subtotal: 500, tax: 90, grandTotal: 620 } });
    await act(async () => { await queryClient.invalidateQueries({ queryKey: customerQueryKeys.cart() }); });

    expect(await screen.findByText("Your cart changed. Apply the promo code again or remove it to continue.")).toBeInTheDocument();
    expect(screen.getAllByText("₹620.00")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Place COD order" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Place COD order" })).toBeEnabled();
    expect(screen.queryByText(/Your cart changed/)).not.toBeInTheDocument();
  });

  it("ignores a pending coupon result for an earlier cart and can reapply to the new cart", async () => {
    let resolveCoupon!: (value: CouponValidation) => void;
    mocks.validateCoupon.mockImplementationOnce(() => new Promise<CouponValidation>((resolve) => { resolveCoupon = resolve; }));
    const { queryClient } = renderCheckout();
    fireEvent.change(await screen.findByLabelText("Promo code"), { target: { value: "SURGICAL10" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    mocks.getCart.mockResolvedValue({ ...cart, items: [{ ...cart.items[0], quantity: 1, subtotal: 500, tax: 90 }], totals: { ...cart.totals, subtotal: 500, tax: 90, grandTotal: 620 } });
    await act(async () => { await queryClient.invalidateQueries({ queryKey: customerQueryKeys.cart() }); });
    await act(async () => resolveCoupon({ code: "SURGICAL10", discount: 100, grandTotal: 1080, message: "Coupon applied.", subtotal: 1000, tax: 180 }));

    expect(await screen.findByText(/Your cart changed/)).toBeInTheDocument();
    expect(screen.getAllByText("₹620.00")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Place COD order" })).toBeDisabled();
    mocks.validateCoupon.mockResolvedValue({ code: "SURGICAL10", discount: 50, grandTotal: 540, message: "Coupon applied.", subtotal: 500, tax: 90 });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Coupon applied.");
    expect(screen.getAllByText("₹590.00")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Place COD order" })).toBeEnabled();
  });

  it("preserves a valid merchandise coupon when only the delivery quote changes", async () => {
    const secondAddress = { ...address, id: "address_2", isDefault: false, pincode: "110001" };
    mocks.listCustomerAddresses.mockResolvedValue([address, secondAddress]);
    mocks.getCart.mockImplementation((id) => Promise.resolve(id === secondAddress.id ? { ...cart, totals: { ...cart.totals, deliveryCharge: 150, grandTotal: 1310 } } : cart));
    renderCheckout();
    fireEvent.change(await screen.findByLabelText("Promo code"), { target: { value: "SURGICAL10" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Coupon applied.");
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    await waitFor(() => expect(screen.getAllByText("₹1,290.00")).toHaveLength(2));
    expect(screen.getByText("Coupon applied.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place COD order" })).toBeEnabled();
    expect(mocks.validateCoupon).toHaveBeenCalledTimes(1);
  });

  it("completes an online Razorpay checkout and verifies the payment", async () => {
    mocks.createOrder.mockResolvedValue({
      ...order,
      paymentMethod: "ONLINE"
    });
    mocks.getPaymentGatewayStatus.mockResolvedValue({
      message: "Online payment is available.",
      onlinePaymentEnabled: true,
      provider: "razorpay"
    });

    renderCheckout();

    expect(
      await screen.findByText("Asha Clinic", undefined, asyncUiTimeout)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Online payment/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Place order and pay" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Place order and pay" }));

    await waitFor(() => {
      expect(mocks.createOrder).toHaveBeenCalledWith({
        billingAddressId: null,
        couponCode: null,
        paymentMethod: "ONLINE",
        shippingAddressId: "address_1"
      });
    });
    expect(mocks.createRazorpayOrder).toHaveBeenCalledWith("order_1");
    expect(mocks.openRazorpayCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 121000,
        key: "rzp_test_key",
        orderId: "order_razorpay_1"
      })
    );
    expect(mocks.verifyRazorpayPayment).toHaveBeenCalledWith({
      orderId: "order_1",
      razorpay_order_id: "order_razorpay_1",
      razorpay_payment_id: "pay_razorpay_1",
      razorpay_signature: "signature_1"
    });
    expect(mocks.routerReplace).toHaveBeenCalledWith("/order-success/order_1");
  });

  it("routes cancelled Razorpay checkout to payment recovery with the pending order id", async () => {
    mocks.createOrder.mockResolvedValue({
      ...order,
      paymentMethod: "ONLINE"
    });
    mocks.getPaymentGatewayStatus.mockResolvedValue({
      message: "Online payment is available.",
      onlinePaymentEnabled: true,
      provider: "razorpay"
    });
    mocks.openRazorpayCheckout.mockRejectedValue(new Error("Payment was cancelled."));

    renderCheckout();

    expect(
      await screen.findByText("Asha Clinic", undefined, asyncUiTimeout)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Online payment/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Place order and pay" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Place order and pay" }));

    await waitFor(() => {
      expect(mocks.routerReplace).toHaveBeenCalledWith(
        expect.stringContaining("/payment-failed?")
      );
    });
    const failedHref = String(mocks.routerReplace.mock.calls.at(-1)?.[0]);
    const failedUrl = new URL(failedHref, "http://localhost");

    expect(failedUrl.pathname).toBe("/payment-failed");
    expect(failedUrl.searchParams.get("orderId")).toBe("order_1");
    expect(failedUrl.searchParams.get("reason")).toBe("Payment was cancelled.");
    expect(mocks.verifyRazorpayPayment).not.toHaveBeenCalled();
  });

  it("marks online payment unavailable without creating an order or clearing checkout", async () => {
    renderCheckout();

    expect(
      await screen.findByText("Asha Clinic", undefined, asyncUiTimeout)
    ).toBeInTheDocument();

    const onlinePaymentButton = await screen.findByRole(
      "button",
      {
        name: /Online payment/i
      },
      asyncUiTimeout
    );

    expect(onlinePaymentButton).toBeDisabled();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(
      screen.getAllByText("Payment gateway is not configured yet.").length
    ).toBeGreaterThan(0);

    fireEvent.click(onlinePaymentButton);

    expect(screen.getByRole("button", { name: "Place COD order" })).toBeInTheDocument();
    expect(screen.getByText("SurgiPro Artery Forceps")).toBeInTheDocument();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.routerReplace).not.toHaveBeenCalledWith(
      expect.stringContaining("/payment-failed")
    );
  });
});

function renderCheckout() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <CheckoutPage />
      </QueryClientProvider>
    ),
    queryClient
  };
}
