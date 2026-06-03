import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scopedFiles = [
  "brands/_components/brand-management.tsx",
  "categories/_components/category-management.tsx",
  "products/product-management.tsx",
  "inventory/inventory-management.tsx",
  "warehouses/_components/warehouse-management.tsx"
];

function readAdminAppFile(path: string) {
  return readFileSync(join(__dirname, path), "utf8");
}

describe("scoped admin HeroUI modernization", () => {
  it("uses admin-local HeroUI compatibility primitives in every scoped page", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).toContain("@/components/ui/button");
      expect(source, path).toContain("@/components/ui/card");
      expect(source, path).toMatch(/@\/components\/ui\/(?:input|select|textarea|checkbox)/);
    }
  });

  it("removes legacy button and modal classes from scoped pages", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).not.toMatch(
        /className="(?:primaryButton|secondaryButton|ghostButton|dangerButton|dialogBackdrop|confirmationDialog)(?:\s|")/
      );
    }
  });

  it("uses shared shadcn table primitives for scoped data tables", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).toContain("@/components/ui/table");
      expect(source, path).toContain("<Table");
      expect(source, path).toContain("<TableHeader");
      expect(source, path).toContain("<TableRow");
      expect(source, path).toContain("<TableCell");
    }
  });

  it("uses the shared admin confirmation dialog instead of local modal markup", () => {
    const scopedSources = scopedFiles.map(readAdminAppFile).join("\n");
    const productSource = readAdminAppFile("products/product-management.tsx");

    expect(scopedSources).toContain("@/components/admin/confirmation-dialog");
    expect(productSource).not.toContain("function ConfirmationDialog(");
    expect(scopedSources).not.toContain('className="dialogBackdrop"');
  });

  it("does not mention shadcn or Radix in scoped component source", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).not.toMatch(/shadcn|@radix-ui|radix-ui/i);
    }
  });
});
