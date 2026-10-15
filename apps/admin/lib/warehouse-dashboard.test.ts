import { describe, expect, it } from "vitest";
import {
  buildWarehouseDashboardQuery,
  formatCount,
  formatRate,
  formatRelativeTime,
  formatWaitingTime,
  pluralize,
  withWarehouse
} from "./warehouse-dashboard";

const now = new Date(2026, 9, 15, 14, 30);
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("warehouse dashboard helpers", () => {
  it("asks for the chosen period ending today, for one warehouse or all of them", () => {
    expect(buildWarehouseDashboardQuery("warehouse-1", 7, now)).toEqual({
      dateFrom: "2026-10-09",
      dateTo: "2026-10-15",
      warehouseId: "warehouse-1"
    });
    expect(buildWarehouseDashboardQuery("", 30, now)).toEqual({
      dateFrom: "2026-09-16",
      dateTo: "2026-10-15",
      warehouseId: undefined
    });
  });

  it("says how long the oldest order has waited", () => {
    expect(formatWaitingTime(null, now)).toBeNull();
    expect(formatWaitingTime(minutesAgo(45), now)).toBe("45m");
    expect(formatWaitingTime(minutesAgo(120), now)).toBe("2h");
    expect(formatWaitingTime(minutesAgo(200), now)).toBe("3h 20m");
    expect(formatWaitingTime(minutesAgo(3 * 24 * 60 + 5), now)).toBe("3d");
    // A clock slightly ahead of the server never shows a negative wait.
    expect(formatWaitingTime(minutesAgo(-2), now)).toBe("0m");
  });

  it("words recent activity to follow Updated or Last seen", () => {
    expect(formatRelativeTime(minutesAgo(0), now)).toBe("just now");
    expect(formatRelativeTime(minutesAgo(5), now)).toBe("5 min ago");
    expect(formatRelativeTime(minutesAgo(190), now)).toBe("3 h ago");
    expect(formatRelativeTime("2026-10-01T09:00:00.000Z", now)).toBe("1 Oct 2026");
  });

  it("formats rates, counts and plurals for headline figures", () => {
    expect(formatRate(null)).toBe("No data yet");
    expect(formatRate(94.2)).toBe("94.2%");
    expect(formatRate(100)).toBe("100%");
    expect(formatCount(125000)).toBe("1,25,000");
    expect(pluralize(1, "product")).toBe("1 product");
    expect(pluralize(3, "delivery", "deliveries")).toBe("3 deliveries");
  });

  it("keeps the warehouse on links to filtered screens", () => {
    expect(withWarehouse("/inventory", "")).toBe("/inventory");
    expect(withWarehouse("/inventory", "warehouse-1")).toBe("/inventory?warehouseId=warehouse-1");
    expect(withWarehouse("/delivery/assign", "warehouse-1", { orderId: "order-1" })).toBe(
      "/delivery/assign?orderId=order-1&warehouseId=warehouse-1"
    );
  });
});
