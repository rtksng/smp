import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "./page";

const session = vi.hoisted(() => ({ isSuperAdmin: false }));

vi.mock("../../lib/admin-session", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAdminSession: () => ({ isSuperAdmin: session.isSuperAdmin })
}));
vi.mock("../admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("../_components/reports-dashboard", () => ({
  ReportsDashboard: ({ extraActions, title }: { extraActions?: ReactNode; title: string }) => (
    <section aria-label="Company reports">
      <h1>{title}</h1>
      {extraActions}
    </section>
  )
}));
vi.mock("../_components/warehouse-dashboard", () => ({
  WarehouseDashboardPage: () => <section aria-label="Warehouse operations" />
}));

afterEach(() => {
  cleanup();
  session.isSuperAdmin = false;
});

describe("dashboard route", () => {
  it("opens warehouse teams on their own warehouse operations", () => {
    render(<AdminDashboardPage />);

    expect(screen.getByRole("region", { name: "Warehouse operations" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Company reports" })).not.toBeInTheDocument();
  });

  it("keeps company-wide reports for the super admin, with a way into warehouse operations", () => {
    session.isSuperAdmin = true;
    render(<AdminDashboardPage />);

    expect(screen.getByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Warehouse operations" })).toHaveAttribute(
      "href",
      "/dashboard/warehouse"
    );
  });
});
