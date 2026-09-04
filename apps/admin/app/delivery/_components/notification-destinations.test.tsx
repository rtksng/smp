import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryAssignmentsPage } from "./delivery-sections";
import { ProductQuestionsPage, ProductReviewsPage } from "../../product-feedback/_components/product-feedback-sections";

const { request, location } = vi.hoisted(() => ({ request: vi.fn(), location: { query: "" } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.query) }));
vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission: () => false })
}));
vi.mock("../../admin-shell", () => ({ AdminShell: () => null }));

const clients: QueryClient[] = [];
const firstProduct = "76f0fc65-c7ea-4cf7-a65b-1c87627d7887";
const secondProduct = "180c5ca6-4bd9-461c-bdb7-64e96ce56d34";
const emptyResponse = {
  items: [],
  pagination: { hasNextPage: false, hasPreviousPage: false, page: 1, limit: 20, total: 0, totalPages: 0 }
};

beforeEach(() => request.mockResolvedValue(emptyResponse));
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.clearAllMocks();
  location.query = "";
});

function mount(child: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrap = (node: ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
  const view = render(wrap(child));
  return { ...view, update: (node: ReactNode) => view.rerender(wrap(node)) };
}

describe("notification destination filters", () => {
  it("loads the clicked delivery failure and follows another notification on the same route", async () => {
    location.query = "status=FAILED&search=ORD-001";
    const view = mount(<DeliveryAssignmentsPage />);

    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/delivery/assignments", {
      query: expect.objectContaining({ status: "FAILED", search: "ORD-001", page: 1 })
    }));
    expect(screen.getByRole("textbox", { name: "Search delivery assignments" })).toHaveValue("ORD-001");
    expect(request.mock.calls.some(([path]) => path === "/admin/orders" || path === "/admin/warehouses")).toBe(false);

    location.query = "status=ASSIGNED&search=ORD-002";
    view.update(<DeliveryAssignmentsPage />);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/delivery/assignments", {
      query: expect.objectContaining({ status: "ASSIGNED", search: "ORD-002", page: 1 })
    }));
    expect(screen.getByRole("textbox", { name: "Search delivery assignments" })).toHaveValue("ORD-002");
  });

  it("rejects invalid delivery statuses, bounds search, and clears notification filters with Reset", async () => {
    location.query = `status=UNASSIGNED&search=${"x".repeat(140)}`;
    mount(<DeliveryAssignmentsPage />);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/delivery/assignments", {
      query: expect.objectContaining({ status: undefined, search: "x".repeat(100) })
    }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/delivery/assignments", {
      query: expect.objectContaining({ status: undefined, search: undefined })
    }));
  });

  it("scopes questions to the clicked product and replaces the filter for same-route navigation", async () => {
    location.query = `status=PENDING&productId=${firstProduct}`;
    const view = mount(<ProductQuestionsPage />);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/product-feedback", {
      query: expect.objectContaining({ status: "PENDING", productId: firstProduct, type: "QUESTION", page: 1 })
    }));
    expect(screen.getByPlaceholderText("Search by product name, SKU, or copied ID")).toHaveValue(firstProduct);

    location.query = `status=PENDING&productId=${secondProduct}`;
    view.update(<ProductQuestionsPage />);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/product-feedback", {
      query: expect.objectContaining({ productId: secondProduct, type: "QUESTION", page: 1 })
    }));
    expect(screen.getByPlaceholderText("Search by product name, SKU, or copied ID")).toHaveValue(secondProduct);
  });

  it("keeps review status valid for the view and removes the hidden product constraint when editing search", async () => {
    location.query = `status=PENDING_REVIEW&productId=${firstProduct}`;
    mount(<ProductReviewsPage />);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/product-feedback", {
      query: expect.objectContaining({ status: "PENDING_REVIEW", productId: firstProduct, type: "REVIEW" })
    }));
    fireEvent.change(screen.getByPlaceholderText("Search by product name, SKU, or copied ID"), { target: { value: "gloves" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/product-feedback", {
      query: expect.objectContaining({ productId: undefined, productSearch: "gloves", status: "PENDING_REVIEW", type: "REVIEW" })
    }));
  });

  it("ignores invalid product IDs and cross-view status/type overrides", async () => {
    location.query = "status=PENDING_REVIEW&productId=not-a-uuid&type=REVIEW";
    mount(<ProductQuestionsPage />);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/product-feedback", {
      query: expect.objectContaining({ productId: undefined, status: undefined, type: "QUESTION" })
    }));
  });
});
