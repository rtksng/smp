import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const quoteRequestsDir = __dirname;
const sectionsSource = readFileSync(
  join(quoteRequestsDir, "_components/quote-request-sections.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(quoteRequestsDir, "quote-requests-responsive.css"),
  "utf8"
);

describe("quote request responsive layout", () => {
  it("scopes responsive controls and data-table affordances to Quote Requests", () => {
    expect(sectionsSource).toContain('import "../quote-requests-responsive.css"');
    expect(sectionsSource).toContain('className="quoteRequestModule"');
    expect(sectionsSource).toContain("quoteRequestDetailModule");
    expect(sectionsSource).toContain("quoteRequestHeaderActions");
    expect(sectionsSource).toContain("quoteRequestBulkActions");
    expect(sectionsSource).toContain("quoteRequestTableShell");
    expect(sectionsSource).toContain(
      "Swipe sideways to view every quote request option."
    );
    expect(sectionsSource).toContain("quoteRequestResponseEditor");
    expect(sectionsSource).toContain("quoteRequestLineEditor");
  });

  it("keeps mobile KPIs, filters, bulk actions, tables, and detail forms compact", () => {
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.quoteRequestModule \.quoteRequestMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(responsiveStyles).toMatch(
      /\.quoteRequestModule \.quoteRequestFilters\s*{[^}]*grid-template-columns:/s
    );
    expect(responsiveStyles).toContain(
      ".quoteRequestModule .quoteRequestBulkActions .bulkActionBar"
    );
    expect(responsiveStyles).toContain(
      ".quoteRequestModule .quoteRequestTable th:last-child"
    );
    expect(responsiveStyles).toContain(
      ".quoteRequestModule .quoteRequestDetailHeaderActions"
    );
    expect(responsiveStyles).toContain(
      ".quoteRequestModule .quoteRequestSupplementGrid"
    );
  });
});
