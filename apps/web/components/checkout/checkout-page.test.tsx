import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import type { CustomerAddress } from "../../lib/api/customer-profile";
import type { Order } from "../../lib/api/orders";
import { CheckoutPage } from "./checkout-page";

const mocks = vi.hoisted(() => ({
  createCustomerAddress: vi.fn(),
  createOrder: vi.fn(),
  createRazorpayOrder: vi.fn(),
  getPaymentGatewayStatus: vi.fn(),
  getCart: vi.fn(),
  listCustomerAddresses: vi.fn(),
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
  beforeEach(() => {
    mocks.createCustomerAddress.mockReset();
    mocks.createOrder.mockReset();
    mocks.createRazorpayOrder.mockReset();
    mocks.getPaymentGatewayStatus.mockReset();
    mocks.getCart.mockReset();
    mocks.listCustomerAddresses.mockReset();
    mocks.openRazorpayCheckout.mockReset();
    mocks.routerReplace.mockReset();
    mocks.validateCoupon.mockReset();
    mocks.verifyRazorpayPayment.mockReset();
    mocks.updateCustomerAddress.mockReset();
    mocks.getCart.mockResolvedValue(cart);
    mocks.listCustomerAddresses.mockResolvedValue([address]);
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

  it("renders dynamic cart totals and validates required address fields", async () => {
    mocks.listCustomerAddresses.mockResolvedValue([]);

    renderCheckout();

    expect(
      await screen.findByRole("heading", { name: "Cart review" })
    ).toBeInTheDocument();
    expect(screen.getByText("SurgiPro Artery Forceps")).toBeInTheDocument();
    expect(
      screen.getByAltText("SurgiPro Artery Forceps product image")
    ).toHaveAttribute("src", cart.items[0]?.imageUrl);
    expect(screen.getByText("Amount payable")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,210.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add address" }));
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
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

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();

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
    expect(await screen.findByText("Address updated.")).toBeInTheDocument();
  });

  it("applies a promo code and sends it with checkout", async () => {
    renderCheckout();

    fireEvent.change(await screen.findByLabelText("Promo code"), {
      target: { value: "surgical10" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Coupon applied.")).toBeInTheDocument();
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

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();

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

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Online payment/i }));
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

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Online payment/i }));
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

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();

    const onlinePaymentButton = await screen.findByRole("button", {
      name: /Online payment/i
    });

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

  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutPage />
    </QueryClientProvider>
  );
}
