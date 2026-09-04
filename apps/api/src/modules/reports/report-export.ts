import { renderReportExport as renderReportFile } from "@surgical/types";
import type { DashboardReport } from "./reports.service";
import type { DashboardExportFormat, ReportExportView } from "./dto/reports.dto";

export function renderReportExport(
  report: DashboardReport,
  view: ReportExportView,
  format: DashboardExportFormat
) {
  const exported = renderReportFile(report, view, format);
  return { ...exported, body: Buffer.from(exported.body) };
}
