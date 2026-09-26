import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const productFeedbackDir = __dirname;
const landingPageSource = readFileSync(
  join(productFeedbackDir, "page.tsx"),
  "utf8"
);
const sectionsSource = readFileSync(
  join(productFeedbackDir, "_components/product-feedback-sections.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(productFeedbackDir, "_components/product-feedback.css"),
  "utf8"
);

describe("product feedback route split", () => {
  it("uses the product feedback landing page for reviews instead of overview", () => {
    expect(sectionsSource).toContain("ProductFeedbackLandingPage");
    expect(sectionsSource).toContain('<ProductFeedbackDestination view="reviews" />');
    expect(sectionsSource).not.toContain('id: "overview"');
    expect(sectionsSource).not.toContain("ProductFeedbackHub");
    expect(sectionsSource).not.toContain('placeholder="Moderation note"');
    expect(sectionsSource).toContain("Product search");
    expect(sectionsSource).toContain("Copy ID");
    expect(sectionsSource).toContain("Add answer");
    expect(sectionsSource).toContain("View answer");
    expect(sectionsSource).toContain("AnswerQuestionDialog");
    expect(sectionsSource).toContain("productFeedbackAnswerDialogFooter");
    expect(landingPageSource).toContain("<ProductFeedbackLandingPage />");
  });

  it("keeps product feedback navigation focused on reviews and questions", () => {
    expect(sectionsSource).toContain('id: "reviews"');
    expect(sectionsSource).toContain('id: "questions"');
    expect(sectionsSource).not.toContain('title: "Overview"');
  });

  it("keeps feedback controls reachable across responsive viewports", () => {
    expect(sectionsSource).toContain('import "./product-feedback.css"');
    expect(sectionsSource).toContain('className="productFeedbackBulkActions"');
    expect(sectionsSource).toContain(
      'containerClassName="productFeedbackTableViewport"'
    );
    expect(sectionsSource).toContain(
      'className="productFeedbackTableHint"'
    );
    expect(sectionsSource.indexOf("<TableHead>Created</TableHead>")).toBeLessThan(
      sectionsSource.indexOf("<TableHead>Moderation</TableHead>")
    );
    expect(responsiveStyles).toContain(
      ".productFeedbackMetricGrid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));"
    );
    expect(responsiveStyles).toContain(
      ".productFeedbackTableViewport tr > :last-child"
    );
    expect(responsiveStyles).toContain(
      ".productFeedbackBulkActions .bulkActionForm > button"
    );
    expect(responsiveStyles).toContain(
      ".adminDialogPanel.productFeedbackAnswerDialog"
    );
  });
});
