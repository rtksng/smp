import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailableCoupon } from "../../lib/api/coupons";
import { AvailableCoupons } from "./available-coupons";

const mocks = vi.hoisted(() => ({ listAvailableCoupons: vi.fn() }));

vi.mock("../../lib/api/coupons", () => ({
  listAvailableCoupons: mocks.listAvailableCoupons
}));

const percentage: AvailableCoupon = {
  code: "SAVE10",
  expiresAt: "2026-12-31T23:59:59.000Z",
  maxDiscount: 100,
  minOrderAmount: 500,
  type: "PERCENTAGE",
  value: 10
};
const fixed: AvailableCoupon = {
  code: "FLAT50",
  expiresAt: null,
  maxDiscount: null,
  minOrderAmount: null,
  type: "FIXED_AMOUNT",
  value: 50
};

describe("AvailableCoupons", () => {
  beforeEach(() => {
    mocks.listAvailableCoupons.mockReset();
    mocks.listAvailableCoupons.mockResolvedValue({ items: [percentage, fixed] });
  });

  it("shows loading while available coupons are fetched", () => {
    mocks.listAvailableCoupons.mockImplementation(() => new Promise(() => {}));
    renderCoupons();
    expect(screen.getByRole("status")).toHaveTextContent("Loading promo codes...");
    expect(screen.queryByRole("button", { name: /Apply/ })).not.toBeInTheDocument();
  });

  it("does not display an empty list when there are no active offers", async () => {
    mocks.listAvailableCoupons.mockResolvedValue({ items: [] });
    renderCoupons();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Available promo codes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows real percentage and fixed offers with conditions and applies the chosen code", async () => {
    const onApply = vi.fn();
    renderCoupons({ onApply });
    expect(await screen.findByRole("region", { name: "Available promo codes" })).toBeInTheDocument();
    expect(screen.getByText("10% off")).toBeInTheDocument();
    expect(screen.getByText("₹50.00 off")).toBeInTheDocument();
    expect(screen.getByText("Minimum order ₹500.00")).toBeInTheDocument();
    expect(screen.getByText("Save up to ₹100.00")).toBeInTheDocument();
    expect(screen.getByText(/^Expires /)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply FLAT50" }));
    expect(onApply).toHaveBeenCalledWith("FLAT50");
  });

  it("explains minimum spend and disables only ineligible offers", async () => {
    renderCoupons({ subtotal: 400 });
    expect(await screen.findByRole("button", { name: "Apply SAVE10" })).toBeDisabled();
    expect(screen.getByText("Add ₹100.00 more to use this code.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply FLAT50" })).toBeEnabled();
  });

  it("marks the selected code and locks other apply buttons during checkout processing", async () => {
    const { rerender, queryClient } = renderCoupons({ appliedCode: "save10" });
    expect(await screen.findByRole("button", { name: "SAVE10 applied" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply FLAT50" })).toBeEnabled();
    rerender(
      <QueryClientProvider client={queryClient}>
        <AvailableCoupons appliedCode="SAVE10" disabled onApply={vi.fn()} subtotal={1000} />
      </QueryClientProvider>
    );
    expect(screen.getByRole("button", { name: "Apply FLAT50" })).toBeDisabled();
  });

  it("leaves manual entry available on load errors and can retry the real endpoint", async () => {
    mocks.listAvailableCoupons.mockRejectedValueOnce(new Error("Not Found"));
    renderCoupons();
    expect(await screen.findByText(/You can still enter a code above/)).toBeInTheDocument();
    expect(screen.queryByText("SAVE10")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry promo codes" }));
    expect(await screen.findByText("SAVE10")).toBeInTheDocument();
    expect(mocks.listAvailableCoupons).toHaveBeenCalledTimes(2);
  });
});

function renderCoupons(props: Partial<Parameters<typeof AvailableCoupons>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <AvailableCoupons appliedCode={null} disabled={false} onApply={vi.fn()} subtotal={1000} {...props} />
      </QueryClientProvider>
    ),
    queryClient
  };
}
