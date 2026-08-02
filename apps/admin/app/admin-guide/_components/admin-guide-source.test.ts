import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "admin-guide.tsx"), "utf8");

describe("admin guide source", () => {
  it("covers each current admin work area", () => {
    [
      "Categories and brands",
      "Products",
      "Warehouses",
      "Inventory and stock",
      "Orders",
      "Customers",
      "Delivery",
      "Returns and refunds",
      "Coupons",
      "Delivery charges",
      "Quote requests",
      "Product feedback",
      "Dashboard and reports",
      "Settings and access"
    ].forEach((title) => expect(source).toContain(`title: \"${title}\"`));
  });

  it("includes searchable navigation, safe working guidance, and visual workflows", () => {
    expect(source).toContain("Search the admin guide");
    expect(source).toContain("adminGuideToc");
    expect(source).toContain("function GuideFlow");
    expect(source).toContain("Important");
    expect(source).toContain("Don’t");
  });
});
