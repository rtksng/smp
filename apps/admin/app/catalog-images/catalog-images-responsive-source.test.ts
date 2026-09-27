import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "page.tsx"), "utf8");
const responsiveStyles = readFileSync(
  join(__dirname, "catalog-images-responsive.css"),
  "utf8"
);

describe("Catalog images responsive layout", () => {
  it("scopes responsive rules to the catalog images module", () => {
    expect(source).toContain('import "./catalog-images-responsive.css"');
    expect(source).toContain('className="catalogImagesModule"');
    expect(source).toContain("catalogImagesMetricGrid");
    expect(source).toContain("catalogImagesActions");
  });

  it("collapses KPIs to two columns and stretches the action on mobile", () => {
    expect(responsiveStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.catalogImagesMetricGrid\s*{[^}]*repeat\(2, minmax\(0, 1fr\)\)/
    );
    expect(responsiveStyles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.catalogImagesActions > button\s*{[^}]*width: 100%/
    );
  });
});
