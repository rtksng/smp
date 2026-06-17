import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentFailedPage } from "./payment-failed-page";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams
}));

vi.mock("../layout/header", () => ({
  Header: () => <header data-testid="header" />
}));

vi.mock("../layout/footer", () => ({
  Footer: () => <footer data-testid="footer" />
}));

describe("PaymentFailedPage", () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
  });

  it("links failed order recovery to the saved order when an order id is present", () => {
    mocks.searchParams = new URLSearchParams({
      orderId: "order_1",
      reason: "Payment was cancelled."
    });

    render(<PaymentFailedPage />);

    expect(screen.getByText("Payment was cancelled.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retry payment" })).toHaveAttribute(
      "href",
      "/account/orders/order_1"
    );
    expect(screen.getByRole("link", { name: "View orders" })).toHaveAttribute(
      "href",
      "/account/orders"
    );
  });

  it("falls back to checkout recovery when no order id is available", () => {
    render(<PaymentFailedPage />);

    expect(screen.getByRole("link", { name: "Retry checkout" })).toHaveAttribute(
      "href",
      "/checkout"
    );
    expect(screen.getByRole("link", { name: "Back to cart" })).toHaveAttribute(
      "href",
      "/cart"
    );
  });
});
