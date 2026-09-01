import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminAppDir = join(__dirname, "..");
const providersSource = readFileSync(join(adminAppDir, "providers.tsx"), "utf8");
const toasterSource = readFileSync(
  join(adminAppDir, "../components/admin/app-toaster.tsx"),
  "utf8"
);
const notificationsSource = readFileSync(
  join(adminAppDir, "../lib/notifications.ts"),
  "utf8"
);
const settingsSource = readFileSync(
  join(__dirname, "_components/settings-sections.tsx"),
  "utf8"
);

describe("settings toast feedback", () => {
  it("mounts one global toaster", () => {
    expect(providersSource.match(/<AppToaster\b/g)).toHaveLength(1);
    expect(toasterSource.match(/<Toaster\b/g)).toHaveLength(1);
    expect(toasterSource).toContain('position="top-right"');
  });

  it("uses toast variants for settings feedback", () => {
    expect(notificationsSource).toContain("toast.success(");
    expect(notificationsSource).toContain("toast.error(");
    expect(notificationsSource).toContain("toast.info(");
    expect(notificationsSource).toContain("toast.warning(");
    expect(settingsSource).toContain("notify.success(");
    expect(settingsSource).toContain("notify.error(");
    expect(settingsSource).toContain("notify.info(");
    expect(settingsSource).toContain("notify.warning(");
    expect(settingsSource).not.toContain('from "sonner"');
    expect(settingsSource).not.toContain('className="formSuccess"');
  });
});
