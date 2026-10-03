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
    expect(dashboardSource).toContain("report && !isMainDashboard ? (");
  });

  it("keeps navigation, metrics, and actions compact at each breakpoint", () => {
    expect(responsiveStyles).toContain("@media (min-width: 641px)");
    expect(responsiveStyles).toContain("@media (max-width: 980px)");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toMatch(
      /\.reportsModule \.reportMetricGrid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(responsiveStyles).toContain('.reportsModule .reportMetricGrid > [data-span="row"]');
    expect(responsiveStyles).toMatch(
      /\.reportsModule \.reportSectionNav\s*{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(dashboardSource).toContain('aria-label={isMainDashboard ? undefined : "Add filter"}');
    expect(responsiveStyles).toMatch(/\.reportActionLabelCompact\s*{\s*display:\s*none;/s);
  });

  it("only offers the swipe hint and pinned drilldown when a table overflows", () => {
    expect(dashboardSource).toContain("useTableOverflow");
    expect(dashboardSource).toContain("Swipe sideways to view every report detail and drilldown.");
    expect(responsiveStyles).toContain(
      '.reportsModule .reportTableShell[data-overflowing="true"] tr > :last-child'
    );
    expect(responsiveStyles).toContain("position: sticky");
    expect(responsiveStyles).toContain("touch-action: pan-x pan-y");
    expect(responsiveStyles).not.toContain("table-layout: fixed");
    expect(responsiveStyles).toMatch(
      /td\.reportTitleCell > \*\s*{[^}]*white-space:\s*normal !important;/s
    );
  });

  it("turns report rows into labelled cards on phones", () => {
    expect(dashboardSource).toContain('data-label="Orders"');
    expect(dashboardSource).toContain('data-label="Available"');
    expect(dashboardSource).toContain('className="reportLinksCell"');
    expect(responsiveStyles).toMatch(
      /\.reportsModule \.reportDataTable thead\s*{[^}]*clip-path:\s*inset\(50%\);/s
    );
    expect(responsiveStyles).toContain('"title figure"');
  });
});
