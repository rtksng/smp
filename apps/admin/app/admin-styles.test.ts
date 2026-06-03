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
