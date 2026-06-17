import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import type { Order } from "../../lib/api/orders";
import { AccountOrderDetail } from "./account-orders";

const mocks = vi.hoisted(() => ({
  createRazorpayOrder: vi.fn(),
  getOrder: vi.fn(),
  logout: vi.fn(),
  openRazorpayCheckout: vi.fn(),
  reorderOrder: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  setCartSummary: vi.fn(),
  verifyRazorpayPayment: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
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

vi.mock("../../lib/stores/auth-store", () => ({
  useCustomerAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      logout: mocks.logout,
      session: {
        customer: {
          email: "session@example.com",
          firstName: "Asha",
          id: "customer_1",
          lastName: null,
          mobileNumber: "+919800000001"
        },
        tokens: {
          accessToken: "access",
          accessTokenExpiresAt: "2026-06-14T10:00:00.000Z",
          accessTokenExpiresInSeconds: 3600,
          refreshToken: "refresh",
          refreshTokenExpiresAt: "2026-06-21T10:00:00.000Z",
          refreshTokenExpiresInSeconds: 604800,
          tokenType: "Bearer"
        }
      }
    })
}));

vi.mock("../../lib/stores/cart-store", () => ({
  useCartStore: (selector: (state: unknown) => unknown) =>
    selector({
      setSummary: mocks.setCartSummary
    })
}));

vi.mock("../../lib/api/orders", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/api/orders")>(
      "../../lib/api/orders"
    );

  return {
    ...actual,
    getOrder: mocks.getOrder,
    reorderOrder: mocks.reorderOrder
  };
});

vi.mock("../../lib/api/payments", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/payments")>(
    "../../lib/api/payments"
  );

  return {
    ...actual,
    createRazorpayOrder: mocks.createRazorpayOrder,
    verifyRazorpayPayment: mocks.verifyRazorpayPayment
  };
});

vi.mock("../../lib/checkout/razorpay", () => ({
  openRazorpayCheckout: mocks.openRazorpayCheckout
}));

const order: Order = {
  createdAt: "2026-06-02T10:00:00.000Z",
  deliveryTracking: [],
  id: "order_1",
  items: [
    {
      id: "item_1",
      name: "Curved Artery Forceps",
      productId: "product_1",
      quantity: 2,
      sku: "FORCEPS-001",
      stockBatchId: null,
      taxAmount: 50.4,
      taxRate: 18,
      total: 330.4,
      unitPrice: 140,
      variantId: null,
      warehouseId: null
    }
  ],
  orderNumber: "ORD-20260602-ABC12345",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  placedAt: "2026-06-02T10:00:00.000Z",
  refunds: [],
  shippingAddress: {
    city: "Mumbai",
    country: "India",
    fullName: "Asha Clinic",
    id: "address_1",
    line1: "12 Surgical Street",
    line2: "Suite 4",
    mobileNumber: "+919876543210",
    pincode: "400001",
    state: "Maharashtra"
  },
  status: "CONFIRMED",
  statusHistory: [],
  totals: {
    deliveryCharge: 50,
    discount: 0,
    grandTotal: 380.4,
    subtotal: 280,
    tax: 50.4
  },
  updatedAt: "2026-06-02T10:00:00.000Z",
  warehouseId: null
};

const reorderedCart: Cart = {
  id: "cart_1",
  itemCount: 1,
  items: [],
  totalQuantity: 2,
  totals: {
    deliveryCharge: 0,
    discount: 0,
    grandTotal: 330.4,
    subtotal: 280,
    tax: 50.4
  },
  updatedAt: "2026-06-02T10:00:00.000Z"
};

describe("AccountOrderDetail", () => {
  const asyncUiTimeout = { timeout: 5000 };

  beforeEach(() => {
    mocks.createRazorpayOrder.mockReset();
    mocks.getOrder.mockReset();
    mocks.logout.mockReset();
    mocks.openRazorpayCheckout.mockReset();
    mocks.reorderOrder.mockReset();
    mocks.routerPush.mockReset();
    mocks.routerReplace.mockReset();
    mocks.setCartSummary.mockReset();
    mocks.verifyRazorpayPayment.mockReset();
    mocks.createRazorpayOrder.mockResolvedValue({
      orderId: "order_1",
      paymentId: "payment_1",
      razorpay: {
        amount: 38040,
        currency: "INR",
        keyId: "rzp_test_key",
        orderId: "order_razorpay_1"
      }
    });
    mocks.getOrder.mockResolvedValue(order);
    mocks.openRazorpayCheckout.mockResolvedValue({
      razorpay_order_id: "order_razorpay_1",
      razorpay_payment_id: "pay_razorpay_1",
      razorpay_signature: "signature_1"
    });
    mocks.reorderOrder.mockResolvedValue(reorderedCart);
    mocks.verifyRazorpayPayment.mockResolvedValue({
      orderStatus: "CONFIRMED",
      paymentId: "payment_1",
      paymentStatus: "PAID"
    });
  });

  it("rebuilds the cart from an order and routes the customer to cart review", async () => {
    renderAccountOrderDetail();

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Reorder items" },
        asyncUiTimeout
      )
    );

    await waitFor(() => {
      expect(mocks.reorderOrder).toHaveBeenCalledWith("order_1");
    });
    expect(mocks.setCartSummary).toHaveBeenCalledWith(reorderedCart);
    expect(mocks.routerPush).toHaveBeenCalledWith("/cart");
  });

  it("lets customers retry a failed online payment from order detail", async () => {
    mocks.getOrder.mockResolvedValue({
      ...order,
      paymentMethod: "ONLINE",
      paymentStatus: "FAILED",
      status: "CREATED"
    });

    renderAccountOrderDetail();

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Retry payment" },
        asyncUiTimeout
      )
    );

    await waitFor(() => {
      expect(mocks.createRazorpayOrder).toHaveBeenCalledWith("order_1");
    });
    expect(mocks.openRazorpayCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 38040,
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
    expect(
      await screen.findByText(
        "Payment confirmed successfully.",
        undefined,
        asyncUiTimeout
      )
    ).toBeInTheDocument();
  });

  it("shows detailed return and refund status on order detail", async () => {
    mocks.getOrder.mockResolvedValue({
      ...order,
      paymentStatus: "REFUNDED",
      refunds: [
        {
          amount: 380.4,
          createdAt: "2026-06-04T10:00:00.000Z",
          id: "refund_1",
          processedAt: "2026-06-05T10:00:00.000Z",
          providerRefundId: "rfnd_123",
          reason: "Seal was damaged on delivery.",
          status: "COMPLETED"
        }
      ],
      status: "RETURNED"
    });

    renderAccountOrderDetail();

    expect(
      await screen.findByText("Refund completed", undefined, asyncUiTimeout)
    ).toBeInTheDocument();
    expect(screen.getByText("Refund amount")).toBeInTheDocument();
    expect(screen.getAllByText("₹380.40").length).toBeGreaterThan(0);
    expect(screen.getByText("Provider reference")).toBeInTheDocument();
    expect(screen.getByText("rfnd_123")).toBeInTheDocument();
    expect(screen.getByText("Seal was damaged on delivery.")).toBeInTheDocument();
    expect(screen.getByText("Processed")).toBeInTheDocument();
    expect(screen.getByText("05 Jun 2026")).toBeInTheDocument();
  });
});

function renderAccountOrderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false
      },
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AccountOrderDetail orderId="order_1" />
    </QueryClientProvider>
  );
}
