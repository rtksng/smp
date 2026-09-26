import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ordersDir = __dirname;
const listSource = readFileSync(
  join(ordersDir, "_components", "order-sections.tsx"),
  "utf8"
);
const detailSource = readFileSync(join(ordersDir, "[id]", "page.tsx"), "utf8");
const responsiveStyles = readFileSync(
  join(ordersDir, "orders-responsive.css"),
  "utf8"
);

describe("Orders responsive layout", () => {
  it("keeps the responsive rules scoped to Orders list and detail pages", () => {
    expect(listSource).toContain('import "../orders-responsive.css"');
    expect(listSource).toContain('className="ordersModule ordersListModule"');
    expect(detailSource).toContain('className="ordersModule orderDetailModule"');
    expect(detailSource).toContain("orderDetailMetricGrid");
  });

  it("keeps actions, compact KPIs, bulk controls, and every table column accessible", () => {
    expect(listSource).toContain("ordersHeaderActions");
    expect(listSource).toContain("ordersBulkActions");
    expect(listSource).toContain("Swipe sideways to view every order column.");
    expect(detailSource).toContain("Swipe sideways to view every item column.");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    );
    expect(responsiveStyles).toContain(".ordersBulkActions .bulkActionForm");
    expect(responsiveStyles).toContain(".ordersTableHint");
  });
});
