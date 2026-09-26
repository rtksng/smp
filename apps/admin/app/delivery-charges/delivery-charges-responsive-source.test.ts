import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const deliveryChargeDirectory = dirname(fileURLToPath(import.meta.url));
const sectionsSource = readFileSync(
  join(deliveryChargeDirectory, "_components", "delivery-charge-sections.tsx"),
  "utf8"
);
const editSource = readFileSync(
  join(deliveryChargeDirectory, "_components", "delivery-charge-edit-page.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(deliveryChargeDirectory, "delivery-charges-responsive.css"),
  "utf8"
);

describe("Delivery Charges responsive source", () => {
  it("keeps list, create, edit, bulk, and table layout changes inside the module", () => {
    expect(sectionsSource).toContain('import "../delivery-charges-responsive.css"');
    expect(sectionsSource).toContain('className="deliveryChargeModule"');
    expect(sectionsSource).toContain("data-delivery-charge-view={view}");
    expect(sectionsSource).toContain("deliveryChargeHeaderActions");
    expect(sectionsSource).toContain("deliveryChargeBulkActions");
    expect(sectionsSource).toContain("deliveryChargeTableShell");
    expect(sectionsSource).toContain(
      "Swipe sideways to view every delivery charge rule detail."
    );
    expect(sectionsSource).toContain("deliveryChargeFormGrid");
    expect(editSource).toContain(
      'className="deliveryChargeModule deliveryChargeEditModule"'
    );
    expect(editSource).toContain("deliveryChargeEditPageHeader");
  });

  it("keeps controls reachable at desktop, tablet, and phone breakpoints", () => {
    expect(responsiveStyles).toContain("@media (max-width: 1280px)");
    expect(responsiveStyles).toContain("@media (max-width: 980px)");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.deliveryChargeModule \.deliveryChargeMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toContain(
      ".deliveryChargeModule .deliveryChargeBulkActions .bulkActionForm > button"
    );
    expect(responsiveStyles).toContain(
      ".deliveryChargeModule .deliveryChargeRulesTable th:last-child"
    );
    expect(responsiveStyles).toContain(
      ".deliveryChargeModule .deliveryChargeRulesTable tr > .bulkCheckboxCell"
    );
    expect(responsiveStyles).toMatch(
      /\.deliveryChargeModule \.deliveryChargeFormPanel \.deliveryChargeFormGrid\s*{[^}]*grid-template-columns:\s*1fr/s
    );
  });
});
