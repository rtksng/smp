import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const deliveryDir = __dirname;
const source = readFileSync(
  join(deliveryDir, "_components", "delivery-sections.tsx"),
  "utf8"
);
const bulkSource = readFileSync(
  join(deliveryDir, "_components", "delivery-bulk-assignment.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(deliveryDir, "delivery-responsive.css"),
  "utf8"
);

describe("Delivery responsive layout", () => {
  it("scopes responsive rules to every Delivery view and partner detail", () => {
    expect(source).toContain('import "../delivery-responsive.css"');
    expect(source).toContain('className="deliveryModule"');
    expect(source).toContain('data-delivery-view={view}');
    expect(source).toContain("deliveryPartnerDetailModule");
    expect(source).toContain("deliveryPartnersPanel");
    expect(source).toContain("deliveryAssignmentsPanel");
    expect(source).toContain("deliveryAssignPanel");
  });

  it("keeps compact KPIs, navigation, filters, forms, bulk actions, and tables accessible", () => {
    expect(source).toContain("deliveryHeaderActions");
    expect(source).toContain("deliveryAssignmentFormGrid");
    expect(source).toContain("Swipe sideways to view every partner option.");
    expect(source).toContain("Swipe sideways to view every assignment column.");
    expect(bulkSource).toContain("Swipe sideways to view every selected-order option.");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    );
    expect(responsiveStyles).toContain(".deliverySectionNav");
    expect(responsiveStyles).toContain(".bulkDeliverySection .bulkActionForm");
    expect(responsiveStyles).toContain(".deliveryTableHint");
  });
});
