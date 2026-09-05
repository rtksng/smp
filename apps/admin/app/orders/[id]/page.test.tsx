import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminOrder, OrderStatus } from "../../../lib/order-management";
import { OrderDetailContent } from "./page";

const access = vi.hoisted(() => ({
  permissions: new Set<string>(),
  request: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-1" })
}));

vi.mock("../../../lib/admin-session", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAdminSession: () => ({
    api: { request: access.request },
    hasPermission: (permission: string) => access.permissions.has(permission)
  })
}));

vi.mock("../../admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));

afterEach(() => {
  access.permissions.clear();
  access.request.mockReset();
});

describe("Order detail", () => {
  it("does not load assignment lookups for an order that cannot be assigned", async () => {
    access.permissions.add("delivery.read");
    access.permissions.add("warehouse.read");
    const client = renderOrder(makeOrder("CREATED"));

    expect(
      await screen.findByRole("heading", { name: "ORD-20260901-000001" })
    ).toBeInTheDocument();
    expect(
      access.request.mock.calls.some(
        ([path]) => path === "/admin/delivery-partners" || path === "/admin/warehouses"
      )
    ).toBe(false);
    client.clear();
  });

  it("loads active partners without requesting warehouses the role cannot read", async () => {
    access.permissions.add("delivery.read");
    const client = renderOrder(makeOrder("CONFIRMED"));

    expect(
      await screen.findByRole("heading", { name: "ORD-20260901-000001" })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(access.request).toHaveBeenCalledWith("/admin/delivery-partners", {
        query: { limit: 100, status: "ACTIVE" }
      })
    );
    expect(
      access.request.mock.calls.some(([path]) => path === "/admin/warehouses")
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: /Use order warehouse/ })
    ).toHaveAttribute("data-disabled", "true");
    client.clear();
  });

  it("stops showing a loading title when the order request fails", async () => {
    access.request.mockRejectedValue(new Error("Order was not found."));
    const client = createClient();

    render(
      <QueryClientProvider client={client}>
        <OrderDetailContent />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("heading", { name: "Order unavailable" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Order was not found.");
    client.clear();
  });
});

function renderOrder(order: AdminOrder) {
  access.request.mockImplementation(async (path: string) => {
    if (path === "/admin/orders/order-1") {
      return order;
    }
    if (path === "/admin/delivery-partners" || path === "/admin/warehouses") {
      return { items: [] };
    }

    throw new Error(`Unexpected request: ${path}`);
  });
  const client = createClient();

  render(
    <QueryClientProvider client={client}>
      <OrderDetailContent />
    </QueryClientProvider>
  );

  return client;
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
}

function makeOrder(status: OrderStatus): AdminOrder {
  return {
    billingAddress: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    customer: {
      businessName: null,
      email: "ritik@example.com",
      firstName: "Ritik",
      gstNumber: null,
      id: "customer-1",
      lastName: "Singh",
      mobileNumber: "+919000000000"
    },
    id: "order-1",
    invoice: null,
    items: [],
    orderNumber: "ORD-20260901-000001",
    paymentDetails: [],
    paymentMethod: "COD",
    paymentStatus: "PENDING",
    placedAt: "2026-09-01T10:00:00.000Z",
    refunds: [],
    shippingAddress: null,
    status,
    statusHistory: [],
    totals: {
      deliveryCharge: 0,
      discount: 0,
      grandTotal: 100,
      subtotal: 100,
      tax: 0
    },
    updatedAt: "2026-09-01T10:00:00.000Z",
    warehouse: null,
    warehouseId: null
  };
}
