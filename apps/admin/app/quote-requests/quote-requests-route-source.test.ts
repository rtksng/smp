import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const quoteRequestsDir = __dirname;
const landingPageSource = readFileSync(
  join(quoteRequestsDir, "page.tsx"),
  "utf8"
);
const detailPageSource = readFileSync(
  join(quoteRequestsDir, "[id]/page.tsx"),
  "utf8"
);
const sectionsSource = readFileSync(
  join(quoteRequestsDir, "_components/quote-request-sections.tsx"),
  "utf8"
);

describe("quote requests routes", () => {
  it("uses the quote request landing page for the requests queue instead of overview", () => {
    expect(sectionsSource).toContain("QuoteRequestsLandingPage");
    expect(sectionsSource).toContain('<QuoteRequestsContent view="requests" />');
    expect(sectionsSource).not.toContain('id: "overview"');
    expect(sectionsSource).not.toContain('title: "Overview"');
    expect(sectionsSource).not.toContain("QuoteRequestHub");
    expect(sectionsSource).not.toContain("QuoteRequestSectionNav");
    expect(landingPageSource).toContain("<QuoteRequestsLandingPage />");
  });

  it("opens quote requests on a dedicated edit page", () => {
    expect(sectionsSource).toContain('href={`/quote-requests/${quoteRequest.id}`}');
    expect(sectionsSource).toContain("QuoteRequestDetailPage");
    expect(sectionsSource).toContain('href="/quote-requests"');
    expect(sectionsSource).toContain("<span>Back</span>");
    expect(detailPageSource).toContain("<QuoteRequestDetailPage />");
  });
});
