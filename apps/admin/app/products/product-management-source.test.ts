import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const productManagementPath = join(__dirname, "product-management.tsx");
const productManagementSource = existsSync(productManagementPath)
  ? readFileSync(productManagementPath, "utf8")
  : "";
const productsPageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const createPagePath = join(__dirname, "create/page.tsx");
const editPagePath = join(__dirname, "[id]/edit/page.tsx");

describe("product management route flow", () => {
  it("renders the product list as a table-only page with route links", () => {
    expect(productManagementSource).toContain("<Table");
    expect(productManagementSource).toContain("@/components/ui/table");
    expect(productManagementSource).toContain("href={PRODUCT_CREATE_PATH}");
    expect(productManagementSource).toContain(
      "href={buildProductEditPath(product.id)}"
    );
    expect(productManagementSource).not.toContain("productManagementGrid");
  });

  it("has dedicated create and edit routes that return to the list after saving", () => {
    expect(productsPageSource).toContain('view="list"');
    expect(existsSync(createPagePath)).toBe(true);
    expect(existsSync(editPagePath)).toBe(true);
    expect(productManagementSource).toContain("router.push(PRODUCT_LIST_PATH)");
  });

  it("uses Lexical for product description rich text editing", () => {
    expect(productManagementSource).toContain("LexicalComposer");
    expect(productManagementSource).toContain("RichTextPlugin");
    expect(productManagementSource).toContain("OnChangePlugin");
    expect(productManagementSource).toContain("$generateHtmlFromNodes");
    expect(productManagementSource).toContain("$generateNodesFromDOM");
    expect(productManagementSource).toContain("HeadingNode");
    expect(productManagementSource).toContain("ListNode");
    expect(productManagementSource).toContain("LinkNode");
    expect(productManagementSource).toContain('data-editor="lexical"');
    expect(productManagementSource).toContain("lexicalEditorFrame");
    expect(productManagementSource).toContain("useId");
    expect(productManagementSource).toContain("aria-labelledby={labelId}");
    expect(productManagementSource).not.toContain(
      '<label className="richTextField">'
    );
    expect(productManagementSource).not.toContain("document.execCommand");
  });

  it("uses shared admin shadcn primitives for product operations", () => {
    expect(productManagementSource).toContain("@/components/ui/button");
    expect(productManagementSource).toContain("@/components/ui/card");
    expect(productManagementSource).toContain("@/components/ui/input");
    expect(productManagementSource).toContain("@/components/ui/select");
    expect(productManagementSource).toContain(
      "@/components/admin/confirmation-dialog"
    );
    expect(productManagementSource).not.toContain("function ConfirmationDialog(");
  });
});
