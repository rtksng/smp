import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const productManagementPath = join(__dirname, "product-management.tsx");
const productManagementSource = existsSync(productManagementPath)
  ? readFileSync(productManagementPath, "utf8")
  : "";
const productManagementStyles = readFileSync(
  join(__dirname, "product-management.module.css"),
  "utf8"
);
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

  it("keeps failed create and edit requests inside the form error state", () => {
    const saveHandler = productManagementSource.slice(
      productManagementSource.indexOf("async function handleSave"),
      productManagementSource.indexOf("function requestDeactivate")
    );

    expect(saveHandler).toContain("try {");
    expect(saveHandler).toContain("} catch {");
    expect(saveHandler).toContain("mutationError above");
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
    expect(productManagementSource).toContain("richTextFormatControl");
    expect(productManagementSource).toContain("rowActionControl");
    expect(productManagementSource).toContain("rowIconButton");
    expect(productManagementSource).toContain("useId");
    expect(productManagementSource).toContain("aria-labelledby={labelId}");
    expect(productManagementSource).not.toContain('<label className="richTextField">');
    expect(productManagementSource).not.toContain("document.execCommand");
  });

  it("uses shared admin HeroUI compatibility primitives for product operations", () => {
    expect(productManagementSource).toContain("@/components/ui/button");
    expect(productManagementSource).toContain("@/components/ui/card");
    expect(productManagementSource).toContain("@/components/ui/input");
    expect(productManagementSource).toContain("@/components/ui/select");
    expect(productManagementSource).toContain("@/components/admin/confirmation-dialog");
    expect(productManagementSource).not.toContain("function ConfirmationDialog(");
  });

  it("provides a multi-image product gallery with main-image and removal controls", () => {
    expect(productManagementSource).toContain("multiple: true");
    expect(productManagementSource).toContain('"aria-label": "Upload product images"');
    expect(productManagementSource).toContain('className="imageGalleryGrid"');
    expect(productManagementSource).toContain("Set as main");
    expect(productManagementSource).toContain("Main image");
    expect(productManagementSource).toContain("onRemove(index)");
    expect(productManagementSource).toContain("resolveAdminUploadUrl(image.url)");
    expect(productManagementSource).toContain("<X aria-hidden size={14} />");
    expect(productManagementSource).toContain("<Maximize2 aria-hidden size={14} />");
    expect(productManagementSource).toContain('className="imageGalleryLargePreview"');
  });

  it("opens product filters in the shared drawer without duplicating the filter form", () => {
    expect(productManagementSource).toContain(
      'import { FilterDrawer } from "@/components/admin/filter-drawer";'
    );
    expect(productManagementSource).toContain(
      "<SlidersHorizontal aria-hidden size={16} />"
    );
    expect(productManagementSource).toContain('title="Product filters"');
    expect(productManagementSource).toContain("<ProductFilterFields");
    expect(productManagementSource).toContain(
      'api.request<ProductListResponse>("/admin/products",'
    );
    expect(productManagementSource).toContain(
      "() => buildProductQuery(appliedFilters)"
    );
    expect(productManagementSource).toContain("setAppliedFilters(draftFilters)");
    expect(productManagementSource).toContain("setIsFilterDrawerOpen(false)");
    expect(productManagementSource).not.toContain(
      '<PageHeader level={2} eyebrow="Catalog filters" title="Find products" />'
    );
    expect(productManagementSource).not.toContain('<form className="productFilters"');
  });

  it("offers responsive product page sizes and keeps large tables virtualized", () => {
    expect(productManagementSource).toContain(
      'import styles from "./product-management.module.css"'
    );
    expect(productManagementSource).toContain('data-product-layout="responsive"');
    expect(productManagementSource).toContain(
      'data-product-view={isEditView ? "edit" : "create"}'
    );
    expect(productManagementSource).toContain('aria-label="Core product details"');
    expect(productManagementSource).not.toContain("<h3>Core details</h3>");
    expect(productManagementSource).toContain('aria-label="Product key metrics"');
    expect(productManagementSource).toContain("styles.compactBulkActions");
    expect(productManagementSource).toContain('containerClassName={styles.tableViewport}');
    expect(productManagementSource).toContain(
      "Swipe horizontally to view every product detail and action."
    );
    expect(productManagementSource).toContain("PRODUCT_PAGE_SIZE_OPTIONS");
    expect(productManagementSource).toContain("loadProductPage");
    expect(productManagementSource).toContain(
      "placeholderData: (previousData) => previousData"
    );
    expect(productManagementSource).toContain("startPaginationTransition");
    expect(productManagementSource).toContain("getProductVirtualWindow");
    expect(productManagementSource).toContain("getProductPrefetchServerPages");
    expect(productManagementSource).toContain("queryClient.fetchQuery");
    expect(productManagementSource).toContain("staleTime: PRODUCT_PAGE_STALE_TIME");
    expect(productManagementSource).toContain(
      "currentWindow.start === nextWindow.start"
    );
    expect(productManagementStyles).toContain("flex-wrap: nowrap;");
    expect(productManagementStyles).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));"
    );
    expect(productManagementStyles).toContain(".compactBulkActions");
    expect(productManagementStyles).toContain("min-height: 32px;");
    expect(productManagementStyles).toContain("@media (min-width: 641px)");
    expect(productManagementStyles).toContain(
      "grid-template-columns: minmax(0, 1fr) auto;"
    );
    expect(productManagementStyles).toContain(
      '.productFormPanel[data-product-view="create"]'
    );
  });
});
