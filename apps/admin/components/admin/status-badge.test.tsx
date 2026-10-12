import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentStatusBadge, StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("warns about pending payments without recolouring other pending statuses", () => {
    render(
      <>
        <PaymentStatusBadge status="PENDING" />
        <StatusBadge status="PENDING" />
      </>
    );
    const [payment, other] = screen
      .getAllByText("pending")
      .map((label) => label.closest("[data-slot='badge']"));

    expect(payment).toHaveClass("text-[#8a4b00]");
    expect(other).toHaveClass("text-[#0b5e59]");
  });

  it("keeps the shared tones for every other payment status", () => {
    render(<PaymentStatusBadge status="PAID" />);

    expect(screen.getByText("paid").closest("[data-slot='badge']")).toHaveClass("text-[#0f6f68]");
  });
});
