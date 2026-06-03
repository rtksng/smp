import { existsSync, readFileSync, readdirSync } from "node:fs";
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

function collectAdminSourceFiles() {
  const sourceRoots = ["app", "components", "lib"];
  const sourceFiles: string[] = [];

  function visit(relativeDir: string) {
    for (const entry of readdirSync(join(adminRoot, relativeDir), { withFileTypes: true })) {
      const relativePath = join(relativeDir, entry.name).replaceAll("\\", "/");

      if (entry.isDirectory()) {
        if (entry.name === ".next" || entry.name === "node_modules") {
          continue;
        }

        visit(relativePath);
        continue;
      }

      if (
        entry.isFile() &&
        /\.(?:ts|tsx)$/.test(entry.name) &&
        !/\.d\.ts$/.test(entry.name) &&
        !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)
      ) {
        sourceFiles.push(relativePath);
      }
    }
  }

  for (const sourceRoot of sourceRoots) {
    visit(sourceRoot);
  }

  return sourceFiles;
}

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
      const wrapperPath = join(adminRoot, file);
      const wrapperExists = existsSync(wrapperPath);

      expect.soft(
        wrapperExists,
        `${file} should exist as a planned HeroUI-backed admin wrapper`
      ).toBe(true);

      if (!wrapperExists) {
        continue;
      }

      const source = readAdmin(file);

      expect.soft(source, file).toMatch(/from "@heroui\//);
      expect.soft(source, file).not.toMatch(/from "@radix-ui\//);
      expect.soft(source, file).not.toMatch(/from "radix-ui"/);
    }
  });

  it("does not import Radix directly anywhere in admin source", () => {
    for (const file of collectAdminSourceFiles()) {
      const source = readAdmin(file);

      expect(source, file).not.toMatch(/@radix-ui|radix-ui/);
    }
  });
});
