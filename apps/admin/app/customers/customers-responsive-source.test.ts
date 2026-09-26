import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const customersDir = __dirname;
const listSource = readFileSync(
  join(customersDir, "_components", "customer-sections.tsx"),
  "utf8"
);
const detailSource = readFileSync(join(customersDir, "[id]", "page.tsx"), "utf8");
const responsiveStyles = readFileSync(
  join(customersDir, "customers-responsive.css"),
  "utf8"
);

describe("Customers responsive layout", () => {
  it("keeps the responsive rules scoped to customer list and detail pages", () => {
    expect(listSource).toContain('import "../customers-responsive.css"');
    expect(listSource).toContain('className="customersModule customersListModule"');
    expect(detailSource).toContain('import "../customers-responsive.css"');
    expect(detailSource).toContain('className="customersModule customerDetailModule"');
  });

  it("keeps compact actions, KPIs, bulk controls, and every table option accessible", () => {
    expect(listSource).toContain("customerHeaderActions");
    expect(listSource).toContain("customerBulkActions");
    expect(listSource).toContain("Swipe sideways to view every customer option.");
    expect(detailSource).toContain("customerDetailHeaderActions");
    expect(detailSource).toContain("Swipe sideways to view every order option.");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.customersModule \.customerMetricGrid,[\s\S]*?\.customersModule \.customerDetailMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(responsiveStyles).toContain(".customerBulkActions .bulkActionForm");
    expect(responsiveStyles).toContain(".customerTableHint");
  });

  it("keeps list and order-table actions pinned while their tables scroll", () => {
    expect(responsiveStyles).toContain("@media (max-width: 1440px)");
    expect(responsiveStyles).toContain(
      ".customersModule :is(.customerTable, .customerOrdersTable) th:last-child"
    );
    expect(responsiveStyles).toContain("position: sticky");
    expect(responsiveStyles).toContain("touch-action: pan-x pan-y");
  });
});
