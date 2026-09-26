import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const categoryManagementPath = join(__dirname, "category-management.tsx");
const categoryManagementSource = existsSync(categoryManagementPath)
  ? readFileSync(categoryManagementPath, "utf8")
  : "";
const categoriesPageSource = readFileSync(join(__dirname, "../page.tsx"), "utf8");
const createPagePath = join(__dirname, "../create/page.tsx");
const bulkCreatePagePath = join(__dirname, "../bulk-create/page.tsx");
const editPagePath = join(__dirname, "../[id]/edit/page.tsx");
const catalogStyles = readFileSync(
  join(__dirname, "../../../components/admin/catalog-management.css"),
  "utf8"
);

describe("category management route flow", () => {
  it("renders the category list as a table-only page with route links", () => {
    expect(categoryManagementSource).toContain("<Table");
    expect(categoryManagementSource).toContain("@/components/ui/table");
    expect(categoryManagementSource).toContain("href={CATEGORY_CREATE_PATH}");
    expect(categoryManagementSource).toContain(
      "href={buildCategoryEditPath(category.id)}"
    );
    expect(categoryManagementSource).not.toContain("splitGrid");
  });

  it("has dedicated create and edit routes that return to the list after saving", () => {
    expect(categoriesPageSource).toContain('view="list"');
    expect(existsSync(createPagePath)).toBe(true);
    expect(existsSync(editPagePath)).toBe(true);
    expect(categoryManagementSource).toContain("router.push(CATEGORY_LIST_PATH)");
  });

  it("keeps failed create and edit requests inside the form error state", () => {
    const submitHandler = categoryManagementSource.slice(
      categoryManagementSource.indexOf("async function handleSubmit"),
      categoryManagementSource.indexOf("function requestDelete")
    );

    expect(submitHandler).toContain("try {");
    expect(submitHandler).toContain("} catch {");
    expect(submitHandler).toContain("mutationError above");
  });

  it("warns that linked products must be cleared before category deletion", () => {
    expect(categoryManagementSource).toContain(
      "Reassign or delete linked products first."
    );
  });

  it("summarizes child categories in the table and opens a modal to choose one", () => {
    expect(categoryManagementSource).toContain("filterRootCategories");
    expect(categoryManagementSource).toContain("formatChildCategoryCount");
    expect(categoryManagementSource).toContain("ChildCategoryModal");
    expect(categoryManagementSource).toContain("setChildCategoryModal(category)");
    expect(categoryManagementSource).toContain("@/components/ui/dialog");
    expect(categoryManagementSource).toContain("categoryChildDialog");
    expect(categoryManagementSource).not.toContain(
      'className="' + "dialog" + "Backdrop" + '"'
    );
    expect(categoryManagementSource).not.toContain("categoryChildModalBackdrop");
    expect(categoryManagementSource).not.toContain("categoryChildItem");
  });

  it("offers a bulk category creation page with existing roots as parent options", () => {
    expect(existsSync(bulkCreatePagePath)).toBe(true);
    expect(categoryManagementSource).toContain("CatalogBulkCreateWorkspace");
    expect(categoryManagementSource).toContain("CATEGORY_BULK_CREATE_PATH");
    expect(categoryManagementSource).toContain("Bulk create categories");
    expect(categoryManagementSource).toContain('kind="category"');
    expect(categoryManagementSource).toContain(
      'api.request<AdminCategory>("/admin/categories"'
    );
    expect(categoryManagementSource).toContain("parentOptions={categories.map");
    expect(categoryManagementSource).not.toContain("setIsBulkCreateOpen");
  });

  it("places category search at the end of the managed categories heading", () => {
    expect(categoryManagementSource).toContain('className="catalogListHeader"');
    expect(categoryManagementSource).toContain('className="catalogListSearch"');
    expect(categoryManagementSource).toContain('aria-label="Search categories"');
  });

  it("keeps category lists, forms, and child-category actions responsive", () => {
    expect(categoryManagementSource).toContain('className="catalogOverviewHeader"');
    expect(categoryManagementSource).toContain('className="catalogFormHeader"');
    expect(categoryManagementSource).toContain(
      'className="metricGrid resourceMetrics catalogMetrics"'
    );
    expect(categoryManagementSource).toContain(
      'containerClassName="catalogTableViewport categoryChildTableViewport"'
    );
    expect(catalogStyles).toMatch(
      /\.catalogTableViewport \.categoryDataTable\s*\{[\s\S]*?min-width:\s*940px !important/
    );
    expect(catalogStyles).toMatch(
      /\.catalogTableViewport tr > :last-child\s*\{[\s\S]*?position:\s*sticky/
    );
  });
});
