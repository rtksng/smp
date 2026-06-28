import { describe, expect, it } from "vitest";
import { customerLoginHref, isPrivateCustomerPath } from "./routes";

describe("customer protected routes", () => {
  it("matches the customer private route set", () => {
    expect(isPrivateCustomerPath("/checkout")).toBe(true);
    expect(isPrivateCustomerPath("/cart")).toBe(true);
    expect(isPrivateCustomerPath("/account")).toBe(true);
    expect(isPrivateCustomerPath("/account/profile")).toBe(true);
    expect(isPrivateCustomerPath("/account/addresses")).toBe(true);
    expect(isPrivateCustomerPath("/account/orders")).toBe(true);
    expect(isPrivateCustomerPath("/account/orders/order_123")).toBe(true);
    expect(isPrivateCustomerPath("/account/quotes")).toBe(true);
    expect(isPrivateCustomerPath("/account/wishlist")).toBe(true);
    expect(isPrivateCustomerPath("/order-success/order_123")).toBe(true);
    expect(isPrivateCustomerPath("/products")).toBe(false);
  });

  it("builds login links with the previous path preserved", () => {
    expect(customerLoginHref("/account/orders/order_123?tab=invoice")).toBe(
      "/login?next=%2Faccount%2Forders%2Forder_123%3Ftab%3Dinvoice"
    );
  });
});
