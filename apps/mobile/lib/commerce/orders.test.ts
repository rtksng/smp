import { describe, expect, it } from "vitest";
import { canCancelOrder, canRequestReturn } from "./orders";

describe("customer order actions", () => {
  it.each(["CREATED", "CONFIRMED", "PACKED", "ASSIGNED"] as const)(
    "allows cancellation while an order is %s",
    (status) => {
      expect(canCancelOrder(status)).toBe(true);
    }
  );

  it.each(["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"] as const)(
    "blocks cancellation once an order is %s",
    (status) => {
      expect(canCancelOrder(status)).toBe(false);
    }
  );

  it("allows a return request only for a delivered order without an active refund", () => {
    expect(canRequestReturn("DELIVERED", [])).toBe(true);
    expect(canRequestReturn("DELIVERED", [{ status: "PENDING" }])).toBe(false);
    expect(canRequestReturn("PACKED", [])).toBe(false);
  });
});
