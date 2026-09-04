import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CouponCreatePage, CouponListPage } from "./coupon-sections";
import type { AdminCoupon } from "../../../lib/support-management";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../../lib/admin-session", () => ({ useAdminSession: () => ({ api: { request } }) }));
vi.mock("../../admin-shell", () => ({ AdminShell: () => null }));

const coupon: AdminCoupon = {
  id: "coupon-qa", code: "DECIMAL75", type: "PERCENTAGE", value: 7.5,
  minOrderAmount: 500.25, maxDiscount: 40.5, usageLimit: 4, usedCount: 0,
  startsAt: null, expiresAt: null, isActive: false
};
const clients: QueryClient[] = [];
const list = (items: AdminCoupon[]) => ({ items, pagination: {
  page: 1, limit: 20, total: items.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false
} });
function renderPage(view: "create" | "list" = "create") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{view === "create" ? <CouponCreatePage /> : <CouponListPage />}</QueryClientProvider>);
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
beforeEach(() => request.mockReset().mockResolvedValue(list([])));
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe("Coupon create and list flow", () => {
  it("blocks invalid input, saves a decimal coupon, and locks the form until saved", async () => {
    let finishSave!: (coupon: AdminCoupon) => void;
    request.mockImplementation(async (_path: string, options?: { method?: string }) =>
      options?.method === "POST" ? new Promise<AdminCoupon>((resolve) => { finishSave = resolve; }) : list([])
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Create coupon" }));
    expect(await screen.findByText("Enter a coupon code.")).toBeInTheDocument();
    expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);

    fill("Code", " decimal75 ");
    fill("Discount value", "7.5");
    fill("Minimum order amount", "500.25");
    fill("Maximum discount", "40.50");
    fill("Usage limit", "4");
    fireEvent.click(screen.getByRole("checkbox", { name: "Active for customer checkout" }));
    expect(screen.getByLabelText("Discount value")).toHaveAttribute("step", "0.01");
    fireEvent.click(screen.getByRole("button", { name: "Create coupon" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled());
    expect(screen.getByLabelText("Code")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Active for customer checkout" })).toBeDisabled();
    const post = request.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(post![1].body)).toEqual({
      code: "DECIMAL75", type: "PERCENTAGE", value: 7.5, minOrderAmount: 500.25,
      maxDiscount: 40.5, usageLimit: 4, startsAt: null, expiresAt: null, isActive: false
    });
    await act(async () => finishSave(coupon));
    expect(await screen.findByText("Coupon created.")).toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toHaveValue("");
  }, 15000);

  it("retains a rejected coupon and supports correcting and retrying it", async () => {
    let attempts = 0;
    request.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method !== "POST") return list([]);
      if (++attempts === 1) throw new Error("Coupon code already exists.");
      return coupon;
    });
    renderPage();
    fill("Code", "DUPLICATE");
    fill("Discount value", "7.5");
    fireEvent.click(screen.getByRole("button", { name: "Create coupon" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Coupon code already exists.");
    expect(screen.getByLabelText("Code")).toHaveValue("DUPLICATE");
    expect(screen.getByLabelText("Discount value")).toHaveValue(7.5);
    fill("Code", "DECIMAL75");
    fireEvent.click(screen.getByRole("button", { name: "Create coupon" }));
    expect(await screen.findByText("Coupon created.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("searches and resets the list, navigates to edit, and archives only after confirmation", async () => {
    let items = [coupon];
    request.mockImplementation(async (_path: string, options?: { method?: string; query?: { search?: string } }) => {
      if (options?.method === "DELETE") { items = []; return coupon; }
      return list(options?.query?.search === "missing" ? [] : items);
    });
    renderPage("list");
    expect(await screen.findByRole("link", { name: "Edit DECIMAL75" })).toHaveAttribute("href", "/coupons/coupon-qa/edit");
    fireEvent.change(screen.getByPlaceholderText("Coupon code"), { target: { value: "missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("No coupons found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive DECIMAL75" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Archive DECIMAL75" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive coupon" }));
    expect(await screen.findByText("Coupon archived.")).toBeInTheDocument();
    expect(await screen.findByText("No coupons found")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("/admin/coupons/coupon-qa", { method: "DELETE" });
  });
});
