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

  it("keeps mobile KPIs, header filters, bulk actions, and tables compact", () => {
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.quoteRequestModule \.quoteRequestMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(responsiveStyles).toContain(
      ".quoteRequestModule .quoteRequestListHeader .adminPageActions"
    );
    expect(responsiveStyles).toContain(
      ".quoteRequestModule .quoteRequestBulkActions .bulkActionBar"
    );
    expect(responsiveStyles).toContain(
      ".quoteRequestModule .quoteRequestTable th:last-child"
    );
    expect(responsiveStyles).not.toContain("table-layout: fixed");
  });

  it("only pins columns while the table overflows and uses labelled cards on phones", () => {
    expect(sectionsSource).toContain("useTableOverflow()");
    expect(sectionsSource).toContain('data-overflowing={isOverflowing ? "true" : undefined}');
    expect(sectionsSource).toContain('data-label="Quotation"');
    expect(responsiveStyles).toContain(
      '.quoteRequestModule .quoteRequestTableShell[data-overflowing="true"]'
    );
    expect(responsiveStyles).toContain('"check customer status"');
    expect(responsiveStyles).toContain("-webkit-line-clamp: 2");
  });

  it("keeps every quotation field labelled and compact on phones", () => {
    expect(sectionsSource).toContain('<QuoteField label="Unit price">');
    expect(sectionsSource).toContain('<QuoteField label="Valid until">');
    expect(responsiveStyles).toMatch(
      /\.quoteRequestModule \.quoteRequestLineAmounts\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toContain(".quoteRequestSupplementGrid");
    expect(responsiveStyles).toMatch(
      /\.quoteRequestModule \.quoteRequestCustomerPanel\s*{[^}]*position:\s*sticky;/s
    );
  });
});
