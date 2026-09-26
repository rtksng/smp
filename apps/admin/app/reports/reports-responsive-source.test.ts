import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const reportsDirectory = dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(
  join(reportsDirectory, "..", "_components", "reports-dashboard.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(reportsDirectory, "reports-responsive.css"),
  "utf8"
);

describe("Reports responsive source", () => {
  it("scopes focused report layouts without wrapping the main dashboard", () => {
    expect(dashboardSource).toContain('import "../reports/reports-responsive.css"');
    expect(dashboardSource).toContain("return isMainDashboard ? content");
    expect(dashboardSource).toContain('className="reportsModule"');
    expect(dashboardSource).toContain("data-report-view={view}");
    expect(dashboardSource).toContain("reportTableShell");
    expect(dashboardSource).toContain(
      "Swipe sideways to view every report detail and drilldown."
    );
  });

  it("keeps navigation, metrics, actions, and drilldowns reachable at each breakpoint", () => {
    expect(responsiveStyles).toContain("@media (max-width: 1280px)");
    expect(responsiveStyles).toContain("@media (max-width: 980px)");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.reportsModule \.reportMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toMatch(
      /\.reportsModule \.reportSectionNav\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toContain(
      ".reportsModule .reportDataTable th:last-child"
    );
    expect(responsiveStyles).toContain(
      '.reportsModule[data-report-view="warehouses"] .reportDataTable [data-slot="table"]'
    );
  });
});
