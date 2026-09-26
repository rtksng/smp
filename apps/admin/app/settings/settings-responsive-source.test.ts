import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsDir = __dirname;
const source = readFileSync(
  join(settingsDir, "_components", "settings-sections.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(settingsDir, "settings-responsive.css"),
  "utf8"
);

describe("Settings responsive layout", () => {
  it("scopes responsive rules to the admin users and roles views", () => {
    expect(source).toContain('import "../settings-responsive.css"');
    expect(source).toContain("settingsAdminUsersModule");
    expect(source).toContain('data-settings-view="admin-users"');
    expect(source).toContain("settingsRolesModule");
    expect(source).toContain('data-settings-view="roles"');
  });

  it("keeps actions, compact two-by-two KPIs, filters, and forms responsive", () => {
    expect(source).toContain("settingsHeaderActions");
    expect(source).toContain("settingsAdminUserFormGrid");
    expect(responsiveStyles).toContain("@media (max-width: 1440px)");
    expect(responsiveStyles).toContain("@media (max-width: 980px)");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.settingsModule \.settingsMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toContain(".settingsModule .settingsFilters");
    expect(responsiveStyles).toContain(".settingsModule .settingsAdminUserFormGrid");
  });

  it("keeps every admin-user and role table option reachable", () => {
    expect(source).toContain("Swipe sideways to view every admin user option.");
    expect(source).toContain("Swipe sideways to view every role and permission.");
    expect(responsiveStyles).toContain("touch-action: pan-x pan-y");
    expect(responsiveStyles).toContain(
      ".settingsModule .settingsAdminUsersTable th:last-child"
    );
    expect(responsiveStyles).toContain(
      ".settingsModule .settingsRolesTable th:first-child"
    );
    expect(responsiveStyles).toContain("position: sticky");
  });
});
