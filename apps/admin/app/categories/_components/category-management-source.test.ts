import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const categoryManagementPath = join(__dirname, "category-management.tsx");
const categoryManagementSource = existsSync(categoryManagementPath)
  ? readFileSync(categoryManagementPath, "utf8")
  : "";
const categoriesPageSource = readFileSync(join(__dirname, "../page.tsx"), "utf8");
const createPagePath = join(__dirname, "../create/page.tsx");
const editPagePath = join(__dirname, "../[id]/edit/page.tsx");

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
});
