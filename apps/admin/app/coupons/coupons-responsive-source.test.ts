import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const couponDirectory = dirname(fileURLToPath(import.meta.url));
const sectionsSource = readFileSync(
  join(couponDirectory, "_components", "coupon-sections.tsx"),
  "utf8"
);
const editSource = readFileSync(
  join(couponDirectory, "_components", "coupon-edit-page.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(couponDirectory, "coupons-responsive.css"),
  "utf8"
);

describe("Coupon responsive source", () => {
  it("keeps the list, create, edit, bulk, and table layouts inside the Coupons module", () => {
    expect(sectionsSource).toContain('import "../coupons-responsive.css"');
    expect(sectionsSource).toContain('className="couponModule"');
    expect(sectionsSource).toContain("data-coupon-view={view}");
    expect(sectionsSource).toContain("couponHeaderActions");
    expect(sectionsSource).toContain("couponBulkActions");
    expect(sectionsSource).toContain("couponTableShell");
    expect(sectionsSource).toContain("Swipe sideways to view every coupon option.");
    expect(sectionsSource).toContain("couponFormGrid");
    expect(editSource).toContain('className="couponModule couponEditModule"');
    expect(editSource).toContain("couponEditPageHeader");
  });

  it("keeps every control accessible at desktop, tablet, and phone breakpoints", () => {
    expect(responsiveStyles).toContain("@media (min-width: 641px)");
    expect(responsiveStyles).toContain("@media (max-width: 980px)");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.couponModule \.couponMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toMatch(
      /\.couponModule \.couponMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toContain(
      ".couponModule .couponBulkActions .bulkActionForm > button"
    );
    expect(responsiveStyles).toContain(".couponModule .couponTable th:last-child");
    expect(responsiveStyles).toContain(
      ".couponModule .couponTable tr > .bulkCheckboxCell"
    );
    expect(responsiveStyles).toMatch(
      /\.couponModule \.couponFormPanel \.couponFormGrid\s*{[^}]*grid-template-columns:\s*1fr/s
    );
  });

  it("searches from the list header and only pins table columns while the table overflows", () => {
    expect(sectionsSource).toContain('role="search"');
    expect(sectionsSource).toContain('placeholder="Coupon code"');
    expect(sectionsSource).toContain("useTableOverflow()");
    expect(sectionsSource).toContain('data-overflowing={isOverflowing ? "true" : undefined}');
    expect(responsiveStyles).not.toContain("table-layout: fixed");
    expect(responsiveStyles).toContain(
      '.couponModule .couponTableShell[data-overflowing="true"]'
    );
    expect(responsiveStyles).toContain('.couponModule .couponSectionHeader .adminPageActions');
  });

  it("turns coupons into labelled cards on phones and keeps forms compact", () => {
    expect(sectionsSource).toContain('data-label="Discount"');
    expect(sectionsSource).toContain('data-label="Window"');
    expect(responsiveStyles).toContain('"check coupon status"');
    expect(sectionsSource).toContain('backHref={view === "new" ? "/coupons/list" : undefined}');
    expect(sectionsSource).not.toContain("View coupons");
    expect(editSource).toContain('backHref="/coupons/list"');
    expect(sectionsSource).toContain('className="couponFormFooter"');
    expect(responsiveStyles).toMatch(
      /\.couponModule \.couponFormFooter\s*{[^}]*justify-content:\s*space-between;/s
    );
  });
});
