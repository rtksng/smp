"use client";

import { AdminShell } from "../../admin-shell";
import { WarehouseDashboardPage } from "../../_components/warehouse-dashboard";
import { ProtectedRoute } from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";

export default function WarehouseOperationsPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ReportsRead}>
        <WarehouseDashboardPage />
      </ProtectedRoute>
    </AdminShell>
  );
}
