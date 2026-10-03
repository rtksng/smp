import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReturnRequestQueuePage } from "./returns-refunds-sections";
import type { AdminOrder } from "../../../lib/order-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";

const { request, hasPermission } = vi.hoisted(() => ({
  request: vi.fn(),
  hasPermission: vi.fn()
}));

vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission })
}));

const returnOrder: AdminOrder = {
  billingAddress: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  customer: {
    businessName: "Asha Clinic",
    email: "asha@example.com",
    firstName: "Asha",
    gstNumber: null,
    id: "11111111-1111-4111-8111-111111111111",
    lastName: "Singh",
    mobileNumber: "+919876543210"
  },
  deliveryTracking: [],
  id: "22222222-2222-4222-8222-222222222222",
  invoice: null,
  items: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Curved Forceps",
      productId: "44444444-4444-4444-8444-444444444444",
      quantity: 2,
      sku: "CF-1",
      stockBatchId: "55555555-5555-4555-8555-555555555555",
      taxAmount: 90,
      taxRate: 18,
      total: 590,
      unitPrice: 250,
      variantId: null,
      warehouseId: "66666666-6666-4666-8666-666666666666"
    }
  ],
  orderNumber: "ORD-RETURN-1",
  paymentDetails: [
    {
      amount: 590,
      createdAt: "2026-09-01T10:00:00.000Z",
      id: "77777777-7777-4777-8777-777777777777",
      method: "ONLINE",
      paidAt: "2026-09-01T10:01:00.000Z",
      provider: "RAZORPAY",
      providerOrderId: "pay-order-1",
      providerPaymentId: "pay-1",
      status: "PAID",
      transactionRef: null
    }
  ],
  paymentMethod: "ONLINE",
  paymentStatus: "PAID",
  placedAt: "2026-09-01T10:00:00.000Z",
  refunds: [
    {
      amount: 590,
      createdAt: "2026-09-03T10:00:00.000Z",
      id: "88888888-8888-4888-8888-888888888888",
      processedAt: null,
      providerRefundId: null,
      reason: "Damaged seal",
      status: "PENDING"
    }
  ],
  shippingAddress: null,
  status: "DELIVERED",
  statusHistory: [],
  totals: {
    deliveryCharge: 0,
    discount: 0,
    grandTotal: 590,
    subtotal: 500,
    tax: 90
  },
  updatedAt: "2026-09-03T10:00:00.000Z",
  warehouse: {
    code: "DEL-01",
    id: "66666666-6666-4666-8666-666666666666",
    name: "Delhi warehouse"
  },
  warehouseId: "66666666-6666-4666-8666-666666666666"
};

const clients: QueryClient[] = [];

function page(items: AdminOrder[] = []) {
  return {
    items,
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      limit: 20,
      page: 1,
      total: items.length,
      totalPages: items.length ? 1 : 0
    }
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <ReturnRequestQueuePage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  hasPermission.mockReset().mockReturnValue(true);
  request.mockReset().mockImplementation(async (path: string) => {
    if (path === "/admin/warehouses") {
      return { items: [returnOrder.warehouse] };
    }
    if (path === "/admin/returns-refunds") {
      return page();
    }
    throw new Error(`Unexpected request: ${path}`);
  });
});

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

describe("Returns and refunds admin flow", () => {
  it("opens filters in a right-side drawer and applies or resets the queue", async () => {
    renderPage();
    expect(await screen.findByText("No returns found")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Returns and refunds sections" })
    ).toBeNull();
    expect(screen.queryByLabelText("Customer mobile")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    let drawer = await screen.findByRole("dialog", {
      name: "Return request filters"
    });
    fireEvent.change(within(drawer).getByLabelText("Customer mobile"), {
      target: { value: " 9876543210 " }
    });
    fireEvent.change(within(drawer).getByLabelText("Order number"), {
      target: { value: "ord-return-1" }
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply filters" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/admin/returns-refunds", {
        query: expect.objectContaining({
          customerMobile: "9876543210",
          orderNumber: "ORD-RETURN-1",
          page: 1
        })
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Return request filters" })
      ).toBeNull()
    );

    // With filters applied the button reports how many are active.
    fireEvent.click(screen.getByRole("button", { name: "Filters, 2 active" }));
    drawer = await screen.findByRole("dialog", { name: "Return request filters" });
    expect(within(drawer).getByLabelText("Customer mobile")).toHaveValue(
      " 9876543210 "
    );
    fireEvent.click(within(drawer).getByRole("button", { name: "Reset" }));
    expect(within(drawer).getByLabelText("Customer mobile")).toHaveValue("");
    expect(within(drawer).getByLabelText("Order number")).toHaveValue("");
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith("/admin/returns-refunds", {
        query: { limit: 20, page: 1 }
      })
    );
  });

  it("does not request forbidden warehouse options for order managers", async () => {
    hasPermission.mockImplementation(
      (permission: string) => permission === ADMIN_PERMISSION.OrdersUpdate
    );
    request.mockImplementation(async (path: string) => {
      if (path === "/admin/warehouses") {
        throw new Error("Warehouse access forbidden");
      }
      return page([returnOrder]);
    });

    renderPage();
    expect(await screen.findByText("ORD-RETURN-1")).toBeInTheDocument();
    expect(hasPermission).toHaveBeenCalledWith(ADMIN_PERMISSION.WarehouseRead);
    expect(request.mock.calls.some(([path]) => path === "/admin/warehouses")).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("approves, rejects, and processes a return with the entered staff note", async () => {
    request.mockImplementation(async (path: string) => {
      if (path === "/admin/warehouses") return { items: [returnOrder.warehouse] };
      if (path === "/admin/returns-refunds") return page([returnOrder]);
      return returnOrder;
    });

    renderPage();
    const note = await screen.findByRole("textbox", {
      name: "Return note for ORD-RETURN-1"
    });
    fireEvent.change(note, { target: { value: " Checked packaging " } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("ORD-RETURN-1 return approved.")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      "/admin/returns-refunds/22222222-2222-4222-8222-222222222222/approve",
      { body: JSON.stringify({ note: "Checked packaging" }), method: "POST" }
    );

    fireEvent.change(note, { target: { value: " Customer withdrew " } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("ORD-RETURN-1 return rejected.")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      "/admin/returns-refunds/22222222-2222-4222-8222-222222222222/reject",
      { body: JSON.stringify({ note: "Customer withdrew" }), method: "POST" }
    );

    fireEvent.click(screen.getByRole("button", { name: "Process/refetch" }));
    expect(
      await screen.findByText("ORD-RETURN-1 refund status refreshed.")
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      "/admin/returns-refunds/22222222-2222-4222-8222-222222222222/process",
      { method: "POST" }
    );
  });

  it("records a valid stock disposition for a returned order", async () => {
    const returnedOrder = { ...returnOrder, status: "RETURNED" as const };
    request.mockImplementation(async (path: string) => {
      if (path === "/admin/warehouses") return { items: [returnedOrder.warehouse] };
      if (path === "/admin/returns-refunds") return page([returnedOrder]);
      return {};
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Record stock" }));
    expect(
      await screen.findByText("ORD-RETURN-1 stock disposition recorded.")
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("/admin/inventory/return-disposition", {
      body: JSON.stringify({
        items: [
          {
            disposition: "RESTOCK",
            orderItemId: "33333333-3333-4333-8333-333333333333",
            quantity: 1
          }
        ],
        orderId: "22222222-2222-4222-8222-222222222222"
      }),
      method: "POST"
    });
  });

  it("shows the return queue failure without rendering stale results", async () => {
    request.mockImplementation(async (path: string) => {
      if (path === "/admin/warehouses") return { items: [] };
      throw new Error("Unable to load return requests");
    });

    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load return requests"
    );
    expect(screen.queryByText("No returns found")).toBeNull();
  });
});
