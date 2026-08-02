import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "delivery-sections.tsx"), "utf8");
const partnerRouteSource = readFileSync(
  join(__dirname, "../partners/[id]/page.tsx"),
  "utf8"
);
const partnersViewSource = source.slice(
  source.indexOf('{view === "partners" ? ('),
  source.indexOf('{view === "assignments" ? (')
);
const partnerListSource = source.slice(
  source.indexOf("function PartnerList"),
  source.indexOf("function PartnerDetail")
);

describe("delivery partner pages source", () => {
  it("keeps delivery KPI cards only on the overview page", () => {
    expect(source).toContain('{view === "overview" ? (');
    expect(source).toContain('className="metricGrid resourceMetrics deliveryMetricGrid"');
    expect(partnersViewSource).not.toContain("deliveryMetricGrid");
  });

  it("shows dynamic delivery charts instead of overview shortcut cards", () => {
    expect(source).toContain(
      "<DeliveryOverviewCharts assignments={assignments} partners={partners} />"
    );
    expect(source).toContain("function DeliveryOverviewCharts");
    expect(source).toContain("buildPartnerStatusChartData(partners)");
    expect(source).toContain("buildAssignmentStatusChartData(assignments)");
    expect(source).toContain("buildAssignmentTrendChartData(assignments)");
    expect(source).toContain("function DeliveryStatusChart");
    expect(source).toContain("function DeliveryAssignmentTrendChart");
    expect(source).toContain('from "recharts"');
    expect(source).toContain("<BarChart");
    expect(source).toContain("<LineChart");
    expect(source).toContain("function DeliveryChartFrame");
    expect(source).toContain("isEmpty={false}");
    expect(source).not.toContain("function DeliveryHub");
    expect(source).not.toContain("deliveryHubGrid");
  });

  it("opens partner detail from the partners table instead of a side panel", () => {
    expect(source).toContain("export function DeliveryPartnerDetailPage");
    expect(partnerRouteSource).toContain("DeliveryPartnerDetailPage");
    expect(partnerListSource).toContain("<TableHead>Detail</TableHead>");
    expect(partnerListSource).toContain('href={`/delivery/partners/${partner.id}`}');
    expect(partnersViewSource).not.toContain("deliveryPartnerDetailPanel");
    expect(partnersViewSource).not.toContain("selectedPartnerId");
    expect(partnerListSource).not.toContain("plainTableButton");
    expect(partnerListSource).not.toContain("onSelect");
  });
});
