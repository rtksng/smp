import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminAppDir = __dirname;
const globalsCss = readFileSync(join(adminAppDir, "globals.css"), "utf8");
const layoutSource = readFileSync(join(adminAppDir, "layout.tsx"), "utf8");
const adminShellSource = readFileSync(join(adminAppDir, "admin-shell.tsx"), "utf8");
const buttonSource = readFileSync(
  join(adminAppDir, "../components/ui/button.tsx"),
  "utf8"
);
const dialogSource = readFileSync(
  join(adminAppDir, "../components/ui/dialog.tsx"),
  "utf8"
);
const dropdownSource = readFileSync(
  join(adminAppDir, "../components/ui/dropdown.tsx"),
  "utf8"
);
const inputSource = readFileSync(
  join(adminAppDir, "../components/ui/input.tsx"),
  "utf8"
);
const metricCardSource = readFileSync(
  join(adminAppDir, "../components/admin/metric-card.tsx"),
  "utf8"
);
const selectSource = readFileSync(
  join(adminAppDir, "../components/ui/select.tsx"),
  "utf8"
);
const tableSource = readFileSync(
  join(adminAppDir, "../components/ui/table.tsx"),
  "utf8"
);

describe("admin layout styles", () => {
  it("uses Outfit as the admin interface font", () => {
    expect(layoutSource).toContain('import { Outfit } from "next/font/google"');
    expect(layoutSource).toContain("variable: \"--font-admin\"");
    expect(layoutSource).toContain('className={outfit.variable}');
    expect(globalsCss).toMatch(/font-family:\s*var\(--font-admin\)/);
  });

  it("keeps wide admin grids from creating page-level overflow", () => {
    expect(globalsCss).toMatch(/\.workspace\s*{[^}]*overflow-x:\s*hidden;/s);
    expect(globalsCss).toMatch(/\.panel\s*{[^}]*min-width:\s*0;/s);
    expect(globalsCss).toMatch(
      /\.productManagementGrid,[\s\S]*?\.warehouseManagementGrid[\s\S]*?{[^}]*min-width:\s*0;/s
    );
    expect(globalsCss).toMatch(/@media \(max-width:\s*1280px\)[\s\S]*?\.productManagementGrid[\s\S]*?grid-template-columns:\s*1fr;/s);
  });

  it("lets dense catalog and inventory controls reflow on narrow screens", () => {
    expect(globalsCss).toMatch(/\.assetRow,[\s\S]*?\.documentRow,[\s\S]*?\.variantRow\s*{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*160px\),\s*1fr\)\);/s);
    expect(globalsCss).toMatch(/@media \(max-width:\s*640px\)[\s\S]*?\.productFilters,[\s\S]*?\.inventoryFilters,[\s\S]*?grid-template-columns:\s*1fr;/s);
  });

  it("keeps button labels and icons visible in admin buttons", () => {
    expect(globalsCss).not.toMatch(/\.panelHeader\s+span\s*{/);
    expect(globalsCss).toMatch(/\.panelHeader\s*>\s*span\s*{/);
  });

  it("wires the button wrapper through HeroUI", () => {
    expect(buttonSource).toContain('from "@heroui/button"');
    expect(buttonSource).toContain("buttonVariants");
    expect(buttonSource).toContain("heroButtonClassName");
  });

  it("keeps shared admin cards and form controls aligned inside their boxes", () => {
    expect(metricCardSource).toContain("items-start");
    expect(metricCardSource).toContain("flex flex-col");
    expect(metricCardSource).toContain("text-left");
    expect(inputSource).toContain("innerWrapper");
    expect(inputSource).toContain("min-w-0 w-full truncate");
    expect(selectSource).toContain("pr-10");
    expect(selectSource).toContain("selectorIcon");
    expect(selectSource).toContain("adminSelectListboxWrapper");
    expect(selectSource).toContain("truncate pr-1");
    expect(globalsCss).toMatch(/\.adminSelectListbox\s*{[^}]*max-height:\s*none !important;/s);
    expect(globalsCss).toMatch(/\.adminSelectListbox\s*{[^}]*overflow:\s*visible !important;/s);
    expect(globalsCss).toMatch(/\.adminSelectListboxWrapper\s*{[^}]*overflow-y:\s*auto !important;/s);
    expect(globalsCss).toMatch(/\.metricCardContent\s*{[^}]*flex-direction:\s*column !important;/s);
    expect(globalsCss).toMatch(/\.searchInput\s*{[^}]*position:\s*relative;/s);
    expect(globalsCss).toMatch(/\.searchInput svg\s*{[^}]*position:\s*absolute;/s);
    expect(globalsCss).toMatch(
      /\.searchInput \[data-slot="input-wrapper"\]\s*{[^}]*padding-left:\s*40px !important;/s
    );
  });

  it("keeps shared admin table, dropdown, and dialog overlays usable in dense tables", () => {
    expect(tableSource).toContain("adminTableViewport");
    expect(tableSource).toContain("adminTableColumn");
    expect(dropdownSource).toContain("adminDropdownContent");
    expect(dropdownSource).toContain("shouldBlockScroll = false");
    expect(dialogSource).toContain("adminDialogWrapper");
    expect(dialogSource).toContain("adminDialogBackdrop");
    expect(dialogSource).toContain("adminDialogPanel");
    expect(globalsCss).toMatch(/\.adminTableViewport\s*{[^}]*max-height:\s*min\(620px,\s*calc\(100dvh - 180px\)\);/s);
    expect(globalsCss).toMatch(/\.adminTableViewport\s*{[^}]*overflow:\s*auto;/s);
    expect(globalsCss).toMatch(/\.adminTableViewport\s*{[^}]*--admin-table-column-max-width:\s*min\(360px,\s*42vw\);/s);
    expect(globalsCss).toMatch(/\.adminTableViewport \[data-slot="table"\]\s*{[^}]*table-layout:\s*auto !important;/s);
    expect(globalsCss).toMatch(/\.adminTableViewport \[data-slot="table"\]\s*{[^}]*width:\s*max-content !important;/s);
    expect(globalsCss).toMatch(/\.adminTableViewport \.adminTableColumn,[\s\S]*?\.adminTableViewport \[data-slot="table-head"\]\s*{[^}]*max-width:\s*var\(--admin-table-column-max-width\) !important;/s);
    expect(globalsCss).toMatch(/\.adminTableViewport \.adminTableColumn,[\s\S]*?\.adminTableViewport \[data-slot="table-head"\]\s*{[^}]*min-width:\s*0 !important;/s);
    expect(globalsCss).toMatch(/\.adminTableViewport \.adminTableColumn,[\s\S]*?\.adminTableViewport \[data-slot="table-head"\]\s*{[^}]*text-overflow:\s*ellipsis !important;/s);
    expect(globalsCss).toMatch(/\.adminTableViewport \.adminTableColumn,[\s\S]*?\.adminTableViewport \[data-slot="table-head"\]\s*{[^}]*white-space:\s*nowrap !important;/s);
    expect(globalsCss).toMatch(/\.adminDropdownContent\s*{[^}]*background:\s*var\(--surface\) !important;/s);
    expect(globalsCss).toMatch(/\.adminDropdownContent\s*{[^}]*z-index:\s*80 !important;/s);
    expect(globalsCss).toMatch(/\.adminDialogWrapper\s*{[^}]*position:\s*fixed !important;/s);
    expect(globalsCss).toMatch(/\.adminDialogWrapper\s*{[^}]*inset:\s*0 !important;/s);
    expect(globalsCss).toMatch(/\.adminDialogBackdrop\s*{[^}]*position:\s*fixed !important;/s);
    expect(globalsCss).toMatch(/\.adminDialogBackdrop\s*{[^}]*height:\s*100dvh !important;/s);
  });

  it("keeps the sidebar fixed while the workspace scrolls independently", () => {
    expect(globalsCss).toMatch(/\.sidebar\s*{[^}]*position:\s*fixed;/s);
    expect(globalsCss).toMatch(/\.sidebar\s*{[^}]*height:\s*100dvh;/s);
    expect(globalsCss).toMatch(/\.sidebarNavScroller\s*{[^}]*overflow-y:\s*auto;/s);
    expect(globalsCss).toMatch(/\.workspace\s*{[^}]*margin-left:\s*var\(--admin-sidebar-width\);/s);
  });

  it("moves admin identity and logout into a fixed sidebar footer", () => {
    expect(adminShellSource).toContain('className="sidebarFooter"');
    expect(adminShellSource).toContain('className="sidebarAdminIdentity"');
    expect(adminShellSource).toContain("handleLogout");
    expect(adminShellSource).not.toContain('className="topbar"');
    expect(adminShellSource).not.toContain('className="adminIdentity"');
  });
});
