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

  it("uses full-width list panels with drawer filters instead of a side form", () => {
    expect(source).toContain("settingsHeaderActions");
    expect(source).toContain("<FilterDrawer");
    expect(source).toContain("<AdminUserFilterFields");
    expect(source).not.toContain("settingsWorkspaceGrid");
    expect(source).not.toContain("settingsFormPanel");
    expect(responsiveStyles).toContain("@media (max-width: 1440px) and (min-width: 641px)");
    expect(responsiveStyles).toContain("@media (max-width: 1280px) and (min-width: 641px)");
    expect(responsiveStyles).toContain("@media (max-width: 980px)");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.settingsModule \.settingsMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
  });

  it("creates and edits admin users in a dialog with a fixed header and footer", () => {
    expect(source).toContain('className="settingsAdminUserDialog"');
    expect(source).toContain("settingsAdminUserFormGrid");
    expect(source).toContain('autoComplete="new-password"');
    expect(responsiveStyles).toMatch(
      /\.adminDialogPanel\.settingsAdminUserDialog\s*{[^}]*overflow:\s*hidden !important;/s
    );
    expect(responsiveStyles).toMatch(
      /\.settingsAdminUserDialogBody\s*{[^}]*overflow-y:\s*auto;/s
    );
    expect(responsiveStyles).toContain(".settingsAdminUserDialog .settingsAdminUserFormGrid");
  });

  it("keeps every admin-user and role table option reachable", () => {
    expect(source).toContain("Swipe sideways to view every admin user option.");
    expect(responsiveStyles).toContain("touch-action: pan-x pan-y");
    expect(responsiveStyles).toContain(
      ".settingsModule .settingsAdminUsersTable tr > :last-child"
    );
    expect(responsiveStyles).toContain(
      ".settingsModule .settingsRolesTable tr > :first-child"
    );
    expect(responsiveStyles).toContain("position: sticky");
    expect(responsiveStyles).toMatch(
      /\.settingsRolesTable td:is\(\.settingsRoleDescriptionCell, \.settingsRolePermissionsCell\),[^{]*{[^}]*white-space:\s*normal !important;/s
    );
  });

  it("turns table rows into labelled cards on phones", () => {
    expect(source).toContain('data-label="Role"');
    expect(source).toContain('data-label="Last login"');
    expect(responsiveStyles).toContain('"admin status"');
    expect(responsiveStyles).toContain('"permissions permissions"');
    expect(responsiveStyles).toMatch(
      /\.settingsModule \.settingsTableShell thead\s*{[^}]*clip-path:\s*inset\(50%\);/s
    );
  });
});
