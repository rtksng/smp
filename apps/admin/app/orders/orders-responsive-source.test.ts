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

  it("shows the swipe hint and pinned columns only while a table scrolls sideways", () => {
    expect(listSource).toContain("useTableOverflow(orders.length > 0)");
    expect(detailSource).toContain("useTableOverflow(order.items.length > 0)");
    expect(listSource).toContain('aria-describedby="orders-table-hint"');
    expect(responsiveStyles).toContain(
      '.ordersTableShell[data-overflowing="true"] .ordersTable tr > .bulkCheckboxCell'
    );
    expect(responsiveStyles).toContain("touch-action: pan-x pan-y");
  });

  it("turns order and item rows into labelled cards on phones", () => {
    expect(listSource).toContain('data-label="Delivery partner"');
    expect(listSource).toContain("ordersStatusStack");
    expect(listSource).toContain("ordersFilterCount");
    expect(detailSource).toContain('data-label="Warehouse"');
    expect(responsiveStyles).toContain('"check warehouse partner"');
    expect(responsiveStyles).toContain('"item item total"');
    expect(responsiveStyles).toContain(
      ".ordersModule .ordersTable thead th:is(.bulkCheckboxCell, .ordersOrderCell)"
    );
  });

  it("keeps the order detail page compact at every width", () => {
    expect(detailSource).toContain('backHref="/orders"');
    expect(detailSource).not.toContain("my-3");
    expect(responsiveStyles).toContain("container: order-detail / inline-size");
    expect(responsiveStyles).toContain("@container order-detail (max-width: 820px)");
    expect(responsiveStyles).toMatch(
      /\.ordersModule \.orderDetailPageHeader \.adminPageHeaderTitle\s*{[^}]*display:\s*block/s
    );
  });
});
