import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = join(__dirname, "..");
const appDir = __dirname;
const packageJson = JSON.parse(
  readFileSync(join(adminRoot, "package.json"), "utf8")
) as { dependencies?: Record<string, string> };

function readAdmin(path: string) {
  return readFileSync(join(adminRoot, path), "utf8");
}

const uiFiles = [
  "components/ui/badge.tsx",
  "components/ui/button.tsx",
  "components/ui/card.tsx",
  "components/ui/checkbox.tsx",
  "components/ui/dialog.tsx",
  "components/ui/dropdown.tsx",
  "components/ui/drawer.tsx",
  "components/ui/input.tsx",
  "components/ui/label.tsx",
  "components/ui/pagination.tsx",
  "components/ui/select.tsx",
  "components/ui/skeleton.tsx",
  "components/ui/spinner.tsx",
  "components/ui/switch.tsx",
  "components/ui/table.tsx",
  "components/ui/tabs.tsx",
  "components/ui/textarea.tsx",
  "components/ui/tooltip.tsx"
];

describe("admin HeroUI modernization", () => {
  it("uses HeroUIProvider in the admin provider stack", () => {
    const providersSource = readFileSync(join(appDir, "providers.tsx"), "utf8");

    expect(providersSource).toContain('import { HeroUIProvider } from "@heroui/system"');
    expect(providersSource).toContain("<HeroUIProvider>");
    expect(providersSource).toContain("<AdminSessionProvider>");
    expect(providersSource).toContain("<QueryClientProvider");
  });

  it("has no direct Radix dependencies in the admin package", () => {
    const dependencies = Object.keys(packageJson.dependencies ?? {});

    expect(dependencies.filter((name) => name.startsWith("@radix-ui/"))).toEqual([]);
    expect(dependencies).not.toContain("radix-ui");
    expect(dependencies).not.toContain("@heroui/react");
  });

  it("keeps repeated admin primitives behind HeroUI-backed wrappers", () => {
    for (const file of uiFiles) {
      const source = readAdmin(file);

      expect(source, file).toMatch(/from "@heroui\//);
      expect(source, file).not.toMatch(/from "@radix-ui\//);
      expect(source, file).not.toMatch(/from "radix-ui"/);
    }
  });

  it("does not import Radix directly anywhere in admin source", () => {
    const scannedFiles = [
      ...uiFiles,
      "components/admin/confirmation-dialog.tsx",
      "components/admin/file-upload-button.tsx",
      "components/admin/metric-card.tsx",
      "components/admin/status-badge.tsx",
      "app/admin-shell.tsx",
      "app/login/page.tsx",
      "app/_components/reports-dashboard.tsx",
      "app/products/product-management.tsx",
      "app/settings/page.tsx",
      "app/delivery/page.tsx"
    ];

    for (const file of scannedFiles) {
      const source = readAdmin(file);

      expect(source, file).not.toMatch(/@radix-ui|radix-ui/);
    }
  });
});
