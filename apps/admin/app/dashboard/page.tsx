"use client";

import { Warehouse } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminShell } from "../admin-shell";
import { ReportsDashboard } from "../_components/reports-dashboard";
import { WarehouseDashboardPage } from "../_components/warehouse-dashboard";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import { WAREHOUSE_DASHBOARD_PATH } from "../../lib/warehouse-management";

export default function AdminDashboardPage() {
  const { isSuperAdmin } = useAdminSession();

  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ReportsRead}>
        {/* Warehouse teams land on their own warehouse's operations instead of company-wide reports. */}
        {isSuperAdmin ? (
          <ReportsDashboard
            eyebrow="Dashboard"
            extraActions={
              <Button asChild className="iconTextButton" variant="outline">
                <Link href={WAREHOUSE_DASHBOARD_PATH}>
                  <Warehouse aria-hidden size={16} />
                  <span>Warehouse operations</span>
                </Link>
              </Button>
            }
            hideSectionNavigation
            title="Admin dashboard"
          />
        ) : (
          <WarehouseDashboardPage />
        )}
      </ProtectedRoute>
    </AdminShell>
  );
}
