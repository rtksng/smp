import { describe, expect, it } from "vitest";
import { canCancelOrder, canRequestReturn, canRetryOnlinePayment, getOrderRefreshInterval } from "./orders";

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

  it("only retries pending or failed online payments for newly created orders", () => {
    const pending = { status: "CREATED" as const, paymentMethod: "ONLINE", paymentStatus: "PENDING" };
    expect(canRetryOnlinePayment(pending)).toBe(true);
    expect(canRetryOnlinePayment({ ...pending, paymentStatus: "FAILED" })).toBe(true);
    expect(canRetryOnlinePayment({ ...pending, paymentStatus: "PAID" })).toBe(false);
    expect(canRetryOnlinePayment({ ...pending, paymentMethod: "COD" })).toBe(false);
    expect(canRetryOnlinePayment({ ...pending, status: "CANCELLED" })).toBe(false);
    expect(canRetryOnlinePayment({ ...pending, status: "DELIVERED" })).toBe(false);
  });

  it("refreshes active deliveries and stops refreshing terminal orders", () => {
    expect(getOrderRefreshInterval("CREATED")).toBe(15_000);
    expect(getOrderRefreshInterval("OUT_FOR_DELIVERY")).toBe(15_000);
    expect(getOrderRefreshInterval("DELIVERED")).toBe(false);
    expect(getOrderRefreshInterval("CANCELLED")).toBe(false);
    expect(getOrderRefreshInterval("RETURNED")).toBe(false);
  });
});
