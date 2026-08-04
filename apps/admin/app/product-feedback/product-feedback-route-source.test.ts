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

describe("product feedback route split", () => {
  it("uses the product feedback landing page for reviews instead of overview", () => {
    expect(sectionsSource).toContain("ProductFeedbackLandingPage");
    expect(sectionsSource).toContain('<ProductFeedbackContent view="reviews" />');
    expect(sectionsSource).not.toContain('id: "overview"');
    expect(sectionsSource).not.toContain("ProductFeedbackHub");
    expect(sectionsSource).not.toContain('placeholder="Moderation note"');
    expect(sectionsSource).toContain("Product search");
    expect(sectionsSource).toContain("Copy ID");
    expect(landingPageSource).toContain("<ProductFeedbackLandingPage />");
  });

  it("keeps product feedback navigation focused on reviews and questions", () => {
    expect(sectionsSource).toContain('id: "reviews"');
    expect(sectionsSource).toContain('id: "questions"');
    expect(sectionsSource).not.toContain('title: "Overview"');
  });
});
