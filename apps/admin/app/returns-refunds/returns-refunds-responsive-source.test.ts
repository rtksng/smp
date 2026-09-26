import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const moduleDir = __dirname;
const managementSource = readFileSync(
  join(moduleDir, "_components", "returns-refunds-sections.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(moduleDir, "returns-refunds-responsive.css"),
  "utf8"
);

describe("Returns and refunds responsive layout", () => {
  it("keeps the responsive work scoped to this module", () => {
    expect(managementSource).toContain(
      'import "../returns-refunds-responsive.css"'
    );
    expect(managementSource).toContain('className="returnsRefundsModule"');
    expect(managementSource).toContain("returnsRefundsHeaderActions");
  });

  it("keeps compact KPIs and every workflow option accessible on phones", () => {
    expect(managementSource).toContain("returnsRefundsTableShell");
    expect(managementSource).toContain(
      "Swipe sideways to view every return and refund option."
    );
    expect(managementSource).toContain("returnsRefundsDispositionForm");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.returnsRefundsModule \.returnsRefundsHeaderActions\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toMatch(
      /\.returnsRefundsModule \.returnsRefundsMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toContain("min-height: 80px");
  });

  it("keeps the workflow table and its action column reachable on narrower screens", () => {
    expect(responsiveStyles).toContain("@media (max-width: 1440px)");
    expect(responsiveStyles).toContain(
      ".returnsRefundsModule .returnsRefundsTableHint"
    );
    expect(responsiveStyles).toContain(
      ".returnsRefundsModule .returnsRefundsTable th:last-child"
    );
    expect(responsiveStyles).toContain("position: sticky");
    expect(responsiveStyles).toContain("touch-action: pan-x pan-y");
  });
});
