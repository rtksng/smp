import { describe, expect, it } from "vitest";
import { resolveAuthReturnTo } from "./return-to";

describe("resolveAuthReturnTo", () => {
  it("keeps known customer routes and their query parameters", () => {
    expect(resolveAuthReturnTo("/search?q=forceps")).toBe(
      "/search?q=forceps"
    );
    expect(resolveAuthReturnTo("/orders/order-1")).toBe("/orders/order-1");
  });

  it("uses the first deep-link query value", () => {
    expect(resolveAuthReturnTo(["/cart", "/checkout"])).toBe("/cart");
  });

  it("rejects external and unknown destinations", () => {
    expect(resolveAuthReturnTo("https://example.com")).toBe("/account");
    expect(resolveAuthReturnTo("//example.com")).toBe("/account");
    expect(resolveAuthReturnTo("/admin")).toBe("/account");
  });
});
