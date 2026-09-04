import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminCoupon, PaginatedAdminResponse } from "../../../lib/support-management";
import { CouponEditPage } from "./coupon-edit-page";

const { request, push, success } = vi.hoisted(() => ({
  request: vi.fn(),
  push: vi.fn(),
  success: vi.fn()
}));

vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request } }),
  ProtectedRoute: ({ children }: { children: ReactNode }) => children
}));
vi.mock("../../admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => children
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));
vi.mock("../../../lib/notifications", () => ({
  notify: { success }
}));

const coupon: AdminCoupon = {
  id: "83858440-7fe0-42e9-9d5b-fd1416e5fd63",
  code: "INACTIVE10",
  type: "PERCENTAGE",
  value: 10,
  minOrderAmount: 500,
  maxDiscount: 150,
  usageLimit: 50,
  usedCount: 3,
  isActive: false,
  startsAt: "2026-09-04T09:45:30.000Z",
  expiresAt: "2026-12-31T23:59:59.999Z"
};

function couponPage(
  items: AdminCoupon[],
  page = 1,
  hasNextPage = false
): PaginatedAdminResponse<AdminCoupon> {
  return {
    items,
    pagination: {
      page,
      limit: 100,
      hasNextPage,
      hasPreviousPage: page > 1,
      total: hasNextPage || page > 1 ? 101 : items.length,
      totalPages: hasNextPage || page > 1 ? 2 : 1
    }
  };
}

function renderEditor(couponId = coupon.id, cachedCoupon?: AdminCoupon) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  if (cachedCoupon) {
    client.setQueryData(["admin", "coupons", "detail", couponId], cachedCoupon);
  }
  render(
    <QueryClientProvider client={client}>
      <CouponEditPage couponId={couponId} />
    </QueryClientProvider>
  );
  return client;
}

describe("CouponEditPage", () => {
  beforeEach(() => {
    request.mockReset();
    push.mockReset();
    success.mockReset();
  });

  it("loads an ID beyond page one, preserves inactive fields and timestamps, then saves only changes", async () => {
    const updatedCoupon = { ...coupon, value: 12 };
    request
      .mockResolvedValueOnce(couponPage([{ ...coupon, id: "another-coupon" }], 1, true))
      .mockResolvedValueOnce(couponPage([coupon], 2))
      .mockResolvedValueOnce(updatedCoupon);
    const client = renderEditor();
    const listKey = ["admin", "coupons", { page: 1 }];
    client.setQueryData(listKey, couponPage([coupon]));

    expect(await screen.findByLabelText("Code", {}, { timeout: 5000 })).toHaveValue("INACTIVE10");
    expect(request).toHaveBeenNthCalledWith(1, "/admin/coupons", {
      query: { page: 1, limit: 100 },
      signal: expect.any(AbortSignal)
    });
    expect(request).toHaveBeenNthCalledWith(2, "/admin/coupons", {
      query: { page: 2, limit: 100 },
      signal: expect.any(AbortSignal)
    });
    expect(screen.getByLabelText("Discount value")).toHaveValue(10);
    expect(screen.getByLabelText("Minimum order amount")).toHaveValue(500);
    expect(screen.getByLabelText("Maximum discount")).toHaveValue(150);
    expect(screen.getByLabelText("Usage limit")).toHaveValue(50);
    expect(screen.getByLabelText("Starts at")).toHaveValue("2026-09-04");
    expect(screen.getByLabelText("Expires at")).toHaveValue("2026-12-31");
    expect(screen.getByRole("checkbox", { name: "Active for customer checkout" })).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("Discount value"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/coupons/list"));
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenLastCalledWith(`/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value: 12 })
    });
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(success).toHaveBeenCalledWith("Coupon updated.");
  }, 15000);

  it("waits for fresh detail before initializing the draft and comparing changes", async () => {
    let resolveFresh!: (value: PaginatedAdminResponse<AdminCoupon>) => void;
    request
      .mockReturnValueOnce(new Promise<PaginatedAdminResponse<AdminCoupon>>((resolve) => {
        resolveFresh = resolve;
      }))
      .mockResolvedValueOnce(coupon);
    const client = renderEditor(coupon.id, coupon);

    expect(screen.queryByLabelText("Discount value")).not.toBeInTheDocument();
    await act(async () => resolveFresh(couponPage([{ ...coupon, value: 12 }])));
    expect(await screen.findByLabelText("Discount value")).toHaveValue(12);

    // Returning to the old cached value must still count as a change from the fresh record.
    fireEvent.change(screen.getByLabelText("Discount value"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/coupons/list"));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(`/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value: 10 })
    });
    expect(client.getQueryData(["admin", "coupons", "detail", coupon.id])).toEqual(coupon);
  });

  it("keeps the draft on a failed PATCH and does not navigate or report success", async () => {
    request
      .mockResolvedValueOnce(couponPage([coupon]))
      .mockRejectedValueOnce(new Error("Coupon code already exists."));
    renderEditor();

    const code = await screen.findByLabelText("Code");
    fireEvent.change(code, { target: { value: "DUPLICATE" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Coupon code already exists.");
    expect(code).toHaveValue("DUPLICATE");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Active for customer checkout" })).not.toBeChecked();
    expect(request).toHaveBeenLastCalledWith(`/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      body: JSON.stringify({ code: "DUPLICATE" })
    });
    expect(push).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(push).toHaveBeenCalledWith("/coupons/list");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("shows an unavailable coupon without a save form when no page contains the requested ID", async () => {
    request.mockResolvedValueOnce(couponPage([coupon]));
    renderEditor("c0a5a2bd-3b4e-419c-bdd9-9ecc45b5c488");

    expect(await screen.findByText("Coupon unavailable")).toBeInTheDocument();
    expect(screen.queryByLabelText("Code")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to coupons" })).toHaveAttribute("href", "/coupons/list");
    expect(request).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
});
