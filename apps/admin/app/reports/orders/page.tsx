"use client";

import { AdminShell } from "../../admin-shell";
import { ReportsDashboard } from "../../_components/reports-dashboard";
import { ProtectedRoute } from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";

export default function OrderReportsPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ReportsRead}>
        <ReportsDashboard view="orders" />
      </ProtectedRoute>
    </AdminShell>
  );
}
