import { describe, expect, it } from "vitest";
import { resolveAuthReturnTo } from "./return-to";

describe("resolveAuthReturnTo", () => {
  it("keeps known customer routes and their query parameters", () => {
    expect(resolveAuthReturnTo("/search?q=forceps")).toBe("/search?q=forceps");
    expect(resolveAuthReturnTo("/orders/order-1")).toBe("/orders/order-1");
    expect(resolveAuthReturnTo("/account/wishlist")).toBe("/account/wishlist");
    expect(resolveAuthReturnTo("/account/quotes")).toBe("/account/quotes");
    expect(resolveAuthReturnTo("/brands/acme")).toBe("/brands/acme");
  });

  it("uses the first deep-link query value", () => {
    expect(resolveAuthReturnTo(["/cart", "/checkout"])).toBe("/cart");
  });

  it("returns to the saved order confirmation after an expired session", () => {
    expect(resolveAuthReturnTo("/order-success/order-1")).toBe("/order-success/order-1");
    expect(resolveAuthReturnTo("/order-success/")).toBe("/account");
  });

  it("rejects external and unknown destinations", () => {
    expect(resolveAuthReturnTo("https://example.com")).toBe("/account");
    expect(resolveAuthReturnTo("//example.com")).toBe("/account");
    expect(resolveAuthReturnTo("/admin")).toBe("/account");
  });
});
