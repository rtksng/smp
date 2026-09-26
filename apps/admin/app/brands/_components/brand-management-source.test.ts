import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const brandManagementPath = join(__dirname, "brand-management.tsx");
const brandManagementSource = existsSync(brandManagementPath)
  ? readFileSync(brandManagementPath, "utf8")
  : "";
const brandsPageSource = readFileSync(join(__dirname, "../page.tsx"), "utf8");
const createPagePath = join(__dirname, "../create/page.tsx");
const bulkCreatePagePath = join(__dirname, "../bulk-create/page.tsx");
const editPagePath = join(__dirname, "../[id]/edit/page.tsx");
const catalogStyles = readFileSync(
  join(__dirname, "../../../components/admin/catalog-management.css"),
  "utf8"
);

describe("brand management route flow", () => {
  it("renders the brand list as a table-only page with route links", () => {
    expect(brandManagementSource).toContain("<Table");
    expect(brandManagementSource).toContain("@/components/ui/table");
    expect(brandManagementSource).toContain("href={BRAND_CREATE_PATH}");
    expect(brandManagementSource).toContain("href={buildBrandEditPath(brand.id)}");
    expect(brandManagementSource).not.toContain("splitGrid");
  });

  it("has dedicated create and edit routes that return to the list after saving", () => {
    expect(brandsPageSource).toContain('view="list"');
    expect(existsSync(createPagePath)).toBe(true);
    expect(existsSync(editPagePath)).toBe(true);
    expect(brandManagementSource).toContain("router.push(BRAND_LIST_PATH)");
  });

  it("keeps failed create and edit requests inside the form error state", () => {
    const submitHandler = brandManagementSource.slice(
      brandManagementSource.indexOf("async function handleSubmit"),
      brandManagementSource.indexOf("function requestDelete")
    );

    expect(submitHandler).toContain("try {");
    expect(submitHandler).toContain("} catch {");
    expect(submitHandler).toContain("mutationError above");
  });

  it("shows brand images in the table and uses image upload copy in the form", () => {
    expect(brandManagementSource).toContain("Brand image");
    expect(brandManagementSource).toContain("<img");
    expect(brandManagementSource).toContain("Upload image");
    expect(brandManagementSource).toContain('body.append("purpose", "brand_logo")');
    expect(brandManagementSource).not.toContain("Logo URL");
    expect(brandManagementSource).not.toContain("Logo available");
  });

  it("offers a dedicated bulk brand creation page", () => {
    expect(existsSync(bulkCreatePagePath)).toBe(true);
    expect(brandManagementSource).toContain("CatalogBulkCreateWorkspace");
    expect(brandManagementSource).toContain("BRAND_BULK_CREATE_PATH");
    expect(brandManagementSource).toContain("Bulk create brands");
    expect(brandManagementSource).toContain('kind="brand"');
    expect(brandManagementSource).toContain('api.request<AdminBrand>("/admin/brands"');
    expect(brandManagementSource).not.toContain("setIsBulkCreateOpen");
  });

  it("places brand search at the end of the managed brands heading", () => {
    expect(brandManagementSource).toContain('className="catalogListHeader"');
    expect(brandManagementSource).toContain('className="catalogListSearch"');
    expect(brandManagementSource).toContain('aria-label="Search brands"');
  });

  it("keeps brand actions and table columns reachable on small screens", () => {
    expect(brandManagementSource).toContain('className="catalogOverviewHeader"');
    expect(brandManagementSource).toContain('className="catalogFormHeader"');
    expect(brandManagementSource).toContain(
      'className="metricGrid resourceMetrics catalogMetrics"'
    );
    expect(brandManagementSource).toContain(
      'containerClassName="catalogTableViewport"'
    );
    expect(catalogStyles).toMatch(
      /\.catalogMetrics\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
    );
    expect(catalogStyles).toMatch(
      /\.catalogTableViewport \.brandDataTable\s*\{[\s\S]*?min-width:\s*820px !important/
    );
  });
});
