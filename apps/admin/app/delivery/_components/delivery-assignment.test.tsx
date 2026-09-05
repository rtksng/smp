import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryAssignPage } from "./delivery-sections";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission: () => true }),
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("../../admin-shell", () => ({ AdminShell: () => null }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, "aria-label": label }: { children: ReactNode; value: string; onValueChange: (value: string) => void; "aria-label": string }) => <select aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)}><option value="">Select</option>{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null
}));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.clearAllMocks(); });

describe("delivery assignment form", () => {
  it("selects eligible orders and active partners from later pages and submits the chosen values", async () => {
    const response = (items: unknown[], page = 1, hasNextPage = false) => ({ items, pagination: { page, limit: 100, hasNextPage, totalPages: 2, hasPreviousPage: page > 1, total: 2 } });
    request.mockImplementation(async (path, options) => {
      const query = options?.query;
      if (path === "/admin/orders") {
        if (query.status === "CONFIRMED") return response([], 1);
        return response([{ id: `order-${query.page}`, orderNumber: `QA-ORDER-${query.page}`, status: "PACKED" }], query.page, query.page === 1);
      }
      if (path === "/admin/delivery-partners" && query.status === "ACTIVE") return response([{ id: `partner-${query.page}`, fullName: `QA Partner ${query.page}`, mobileNumber: "+919000000000", status: "ACTIVE" }], query.page, query.page === 1);
      if (path === "/admin/delivery/assign") return { id: "assignment-1", status: "ASSIGNED" };
      return response([]);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    render(<QueryClientProvider client={client}><DeliveryAssignPage /></QueryClientProvider>);
    await screen.findByRole("option", { name: "QA-ORDER-2 (Packed)" });
    await screen.findByRole("option", { name: /QA Partner 2/ });
    fireEvent.change(screen.getByLabelText("Order"), { target: { value: "order-2" } });
    fireEvent.change(screen.getByLabelText("Delivery partner"), { target: { value: "partner-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign delivery" }));
    await screen.findByText("Assign QA-ORDER-2 to QA Partner 2?");
    fireEvent.click(screen.getAllByRole("button", { name: "Assign delivery" }).at(-1)!);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/delivery/assign", { method: "POST", body: JSON.stringify({ deliveryPartnerId: "partner-2", orderId: "order-2", pickupWarehouseId: null }) }));
    expect(request).toHaveBeenCalledWith("/admin/orders", { query: { limit: 100, page: 1, status: "CONFIRMED" } });
    expect(request).toHaveBeenCalledWith("/admin/warehouses", { query: { limit: 100, page: 1, status: "ACTIVE" } });
  });
});
