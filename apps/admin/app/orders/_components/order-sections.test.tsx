import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrdersLandingPage } from "./order-sections";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("pendingOnly=true&warehouseId=warehouse-1&paymentStatus=PENDING")
}));

vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission: () => false })
}));

vi.mock("../../admin-shell", () => ({ AdminShell: () => null }));

afterEach(() => vi.clearAllMocks());

describe("Orders report destination", () => {
  it("loads scoped orders without requesting warehouse permissions the reader does not have", async () => {
    request.mockResolvedValue({
      items: [],
      pagination: { hasNextPage: false, hasPreviousPage: false, limit: 20, page: 1, total: 0, totalPages: 0 }
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<QueryClientProvider client={client}><OrdersLandingPage /></QueryClientProvider>);

    expect(await screen.findByText("No orders found")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("/admin/orders", {
      query: expect.objectContaining({ pendingOnly: true, warehouseId: "warehouse-1", paymentStatus: "PENDING" })
    });
    expect(request.mock.calls.some(([path]) => path === "/admin/warehouses")).toBe(false);
    client.clear();
  });

  it("shows the assigned delivery partner in the orders table", async () => {
    request.mockResolvedValue({
      items: [
        {
          createdAt: "2026-09-12T10:00:00.000Z",
          customer: {
            firstName: "Ritik",
            lastName: "Singh",
            mobileNumber: "+919000000000"
          },
          deliveryTracking: [
            {
              deliveryPartnerName: "Asha Driver",
              status: "ASSIGNED"
            }
          ],
          id: "order-1",
          orderNumber: "ORD-20260912-000001",
          paymentStatus: "PAID",
          placedAt: "2026-09-12T10:00:00.000Z",
          status: "ASSIGNED",
          totals: { grandTotal: 1299 },
          warehouse: { name: "Delhi warehouse" },
          warehouseId: "warehouse-1"
        }
      ],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 1,
        totalPages: 1
      }
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={client}>
        <OrdersLandingPage />
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("columnheader", { name: "Delivery partner" })
    ).toBeInTheDocument();
    expect(screen.getByText("Asha Driver")).toBeInTheDocument();
    client.clear();
  });

  it("shows numbered pagination with an ellipsis and loads the selected page", async () => {
    request
      .mockResolvedValueOnce(orderPage(1, 20, 240))
      .mockResolvedValueOnce(orderPage(4, 20, 240));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={client}>
        <OrdersLandingPage />
      </QueryClientProvider>
    );

    const pagination = await screen.findByRole("navigation", {
      name: "Orders pagination"
    });
    expect(pagination).toHaveTextContent("12345…12");
    expect(
      screen.getByRole("button", { name: "Go to page 1" })
    ).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "Go to page 4" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/admin/orders", {
        query: expect.objectContaining({ limit: 20, page: 4 })
      })
    );
    await screen.findByText("ORD-PAGE-4");
    client.clear();
  });
});

function orderPage(page: number, limit: number, total: number) {
  return {
    items: [
      {
        createdAt: "2026-09-12T10:00:00.000Z",
        customer: {
          firstName: "Ritik",
          lastName: "Singh",
          mobileNumber: "+919000000000"
        },
        deliveryTracking: [],
        id: `order-${page}`,
        orderNumber: `ORD-PAGE-${page}`,
        paymentStatus: "PAID",
        placedAt: "2026-09-12T10:00:00.000Z",
        status: "CONFIRMED",
        totals: { grandTotal: 1299 },
        warehouse: { name: "Delhi warehouse" },
        warehouseId: "warehouse-1"
      }
    ],
    pagination: {
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
