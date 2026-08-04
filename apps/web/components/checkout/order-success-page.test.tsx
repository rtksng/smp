import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../../lib/api/orders";
import { OrderSuccessPage } from "./order-success-page";

const mocks = vi.hoisted(() => ({
  getOrder: vi.fn()
}));

vi.mock("../auth/protected-customer-route", () => ({
  ProtectedCustomerRoute: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  )
}));

vi.mock("../layout/header", () => ({
  Header: () => <header data-testid="header" />
}));

vi.mock("../layout/footer", () => ({
  Footer: () => <footer data-testid="footer" />
}));

vi.mock("../../lib/api/orders", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/orders")>(
    "../../lib/api/orders"
  );

  return {
    ...actual,
    getOrder: mocks.getOrder
  };
});

const order: Order = {
  createdAt: "2026-06-02T10:00:00.000Z",
  deliveryTracking: [],
  id: "order_1",
  items: [
    {
      id: "order_item_1",
      name: "SurgiPro Artery Forceps",
      productId: "product_1",
      quantity: 2,
      sku: "SP-FOR-10",
      stockBatchId: "batch_1",
      taxAmount: 180,
      taxRate: 18,
      total: 1180,
      unitPrice: 500,
      variantId: "variant_1",
      warehouseId: "warehouse_1"
    },
    {
      id: "order_item_2",
      name: "Sterile Draping Kit",
      productId: "product_2",
      quantity: 1,
      sku: "SDK-01",
      stockBatchId: "batch_2",
      taxAmount: 90,
      taxRate: 12,
      total: 840,
      unitPrice: 750,
      variantId: null,
      warehouseId: "warehouse_1"
    }
  ],
  orderNumber: "ORD-20260602-ABC12345",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  placedAt: "2026-06-02T10:05:00.000Z",
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
  statusHistory: [
    {
      changedById: null,
      createdAt: "2026-06-02T10:05:00.000Z",
      id: "history_1",
      note: "Order validated against available stock.",
      status: "CONFIRMED"
    }
  ],
  totals: {
    deliveryCharge: 50,
    discount: 20,
    grandTotal: 2050,
    subtotal: 1250,
    tax: 270
  },
  updatedAt: "2026-06-02T10:05:00.000Z",
  warehouseId: "warehouse_1"
};

describe("OrderSuccessPage", () => {
  beforeEach(() => {
    mocks.getOrder.mockReset();
    mocks.getOrder.mockResolvedValue(order);
  });

  it("renders a dynamic compact order confirmation from fetched order data", async () => {
    renderOrderSuccess();

    await waitFor(() => {
      expect(mocks.getOrder).toHaveBeenCalledWith("order_1");
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Order confirmed" })
    ).toHaveClass("text-2xl");
    expect(screen.getByText("ORD-20260602-ABC12345")).toBeInTheDocument();
    expect(screen.getByText("Placed 02 Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getAllByText("₹2,050.00").length).toBeGreaterThan(0);
    expect(screen.getByText("SurgiPro Artery Forceps")).toBeInTheDocument();
    expect(screen.getByText("Sterile Draping Kit")).toBeInTheDocument();
    expect(screen.getByText("Cash on delivery")).toBeInTheDocument();
    expect(screen.getAllByText("Payment pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Asha Clinic")).toBeInTheDocument();
    expect(screen.getByText(/12 Surgical Street, Suite 4/)).toBeInTheDocument();
    expect(
      screen.getByText("Order validated against available stock.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue shopping" })
    ).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "View orders" })).toHaveAttribute(
      "href",
      "/account/orders"
    );
  });

  it("removes visual shadows from order success page cards and surfaces", async () => {
    renderOrderSuccess();

    expect(await screen.findByTestId("order-success-main")).toHaveClass(
      "orderSuccessNoShadows"
    );
  });
});

function renderOrderSuccess() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OrderSuccessPage orderId="order_1" />
    </QueryClientProvider>
  );
}
