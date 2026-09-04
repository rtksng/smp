import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
});
