import { describe, expect, it } from "vitest";
import { getCheckoutSubmissionError } from "./checkout-validation";

describe("checkout submission validation", () => {
  it("requires a non-empty cart before order placement", () => {
    expect(
      getCheckoutSubmissionError({
        cartHasItems: false,
        hasBlockingStockIssue: false,
        selectedAddressId: "address_1"
      })
    ).toBe("Your cart is empty.");
  });

  it("requires a selected address", () => {
    expect(
      getCheckoutSubmissionError({
        cartHasItems: true,
        hasBlockingStockIssue: false,
        selectedAddressId: null
      })
    ).toBe("Select a delivery address.");
  });

  it("blocks order placement when stock warnings are active", () => {
    expect(
      getCheckoutSubmissionError({
        cartHasItems: true,
        hasBlockingStockIssue: true,
        selectedAddressId: "address_1"
      })
    ).toBe("Resolve stock warnings before placing the order.");
  });

  it("allows submission when cart, address, and stock are valid", () => {
    expect(
      getCheckoutSubmissionError({
        cartHasItems: true,
        hasBlockingStockIssue: false,
        selectedAddressId: "address_1"
      })
    ).toBeNull();
  });
});
