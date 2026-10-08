import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatSalaryPeriod, getCurrentSalaryPeriod } from "../../../lib/delivery-management";
import { DeliveryPartnerDetailPage, DeliveryPartnersPage } from "./delivery-sections";

const access = vi.hoisted(() => ({
  permissions: new Set<string>(),
  request: vi.fn()
}));

vi.mock("../../../lib/admin-session", () => ({
  PermissionGate: ({ children, permission }: { children: ReactNode; permission: string }) =>
    access.permissions.has(permission) ? <>{children}</> : null,
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAdminSession: () => ({
    admin: { role: { code: "SUPER_ADMIN", name: "Super admin" } },
    api: { request: access.request },
    hasPermission: (permission: string) => access.permissions.has(permission)
  })
}));
vi.mock("../../admin-shell", () => ({ AdminShell: () => null }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, "aria-label": label }: { children: ReactNode; value: string; onValueChange: (value: string) => void; "aria-label": string }) => (
    <select aria-label={label} onChange={(event) => onValueChange(event.target.value)} value={value}>
      <option value="">Select</option>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null
}));

const alpha = {
  address: "Plot 1",
  city: "Pune",
  code: "ALP",
  contactNumber: "+919000000000",
  contactPerson: "Desk",
  id: "w-alpha",
  name: "Alpha Store",
  pincode: "411001",
  state: "Maharashtra"
};
const noPay = { commissionType: null, commissionValue: null, monthlySalary: null, paymentType: null };
const salaryPartner = {
  createdAt: "2026-09-01T10:00:00.000Z",
  documents: [],
  email: null,
  fullName: "Asha Driver",
  id: "partner-1",
  isOnline: true,
  lastSeenAt: null,
  mobileNumber: "+919876543210",
  payment: { ...noPay, monthlySalary: 18000, paymentType: "SALARY" },
  status: "ACTIVE",
  updatedAt: "2026-09-01T10:00:00.000Z",
  vehicleNumber: "MH12AB1234",
  wallet: { balance: 1000, currency: "INR", totalEarnings: 19000 },
  warehouses: [alpha]
};
const applicant = {
  ...salaryPartner,
  fullName: "New Applicant",
  id: "partner-2",
  isOnline: false,
  payment: noPay,
  status: "PENDING_VERIFICATION",
  wallet: { balance: 0, currency: "INR", totalEarnings: 0 },
  warehouses: []
};
const ledgerEntry = (overrides: Record<string, unknown>) => ({
  amount: 0,
  createdAt: "2026-09-30T10:00:00.000Z",
  deliveryAssignmentId: null,
  description: "",
  id: String(Math.random()),
  reference: null,
  salaryPeriod: null,
  type: "PAYOUT",
  ...overrides
});
const earnings = {
  entries: [
    ledgerEntry({ amount: 18000, description: "Salary for September 2026", salaryPeriod: "2026-09", type: "SALARY" }),
    ledgerEntry({ amount: 18000, description: "Wallet payout", reference: "UPI-123", type: "PAYOUT" }),
    ledgerEntry({ amount: 61.25, deliveryAssignmentId: "assignment-1", description: "Commission for QA-1", type: "DELIVERY_EARNING" })
  ],
  payment: salaryPartner.payment,
  payouts: [],
  totals: { commissionEarnings: 1000, completedDeliveries: 12, paidOut: 18000, salaryEarnings: 18000 },
  wallet: salaryPartner.wallet
};
const list = (items: unknown[]) => ({
  items,
  pagination: { hasNextPage: false, hasPreviousPage: false, limit: 20, page: 1, total: items.length, totalPages: 1 }
});
const clients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  access.permissions.clear();
  access.request.mockReset();
});

function grant(permissions: string[]) {
  permissions.forEach((permission) => access.permissions.add(permission));
}

function mockApi(routes: Record<string, (options: { body?: string; method?: string; query?: Record<string, unknown> }) => unknown>) {
  access.request.mockImplementation(async (path: string, options = {}) => {
    const route = routes[path];
    if (!route) throw new Error(`Unexpected request: ${path}`);
    return route(options);
  });
}

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

function metricValue(label: string) {
  return screen.getByText(label, { selector: ".metricCardContent span" }).nextElementSibling?.textContent;
}

describe("Delivery partners list", () => {
  it("shows warehouses and pay, searches partners, and offers add partner to managers", async () => {
    grant(["delivery.read", "delivery.partners.manage"]);
    mockApi({
      "/admin/delivery/assignments": () => list([]),
      "/admin/delivery-partners": () => list([salaryPartner, applicant])
    });
    renderPage(<DeliveryPartnersPage />);

    const table = await screen.findByRole("table", { name: "Delivery partners" });
    expect(within(table).getByRole("columnheader", { name: "Warehouses" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Pay" })).toBeInTheDocument();
    expect(within(table).getByText("Alpha Store (ALP)")).toBeInTheDocument();
    expect(within(table).getByText("₹18,000 / month salary")).toBeInTheDocument();
    expect(within(table).getByText("No warehouses")).toBeInTheDocument();
    expect(within(table).getByText("Pay not set")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add partner" })).toHaveAttribute("href", "/delivery/partners/new");

    fireEvent.change(screen.getByLabelText("Search delivery partners"), { target: { value: "  Asha " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(access.request).toHaveBeenCalledWith("/admin/delivery-partners", {
        query: { limit: 20, page: 1, search: "Asha", status: undefined }
      })
    );
  });

  it("hides add partner without the partner management permission", async () => {
    grant(["delivery.read"]);
    mockApi({
      "/admin/delivery/assignments": () => list([]),
      "/admin/delivery-partners": () => list([salaryPartner])
    });
    renderPage(<DeliveryPartnersPage />);

    await screen.findByRole("table", { name: "Delivery partners" });
    expect(screen.queryByRole("link", { name: "Add partner" })).not.toBeInTheDocument();
  });
});

describe("Delivery partner detail", () => {
  it("shows warehouses, pay, earnings, and records a salary credit after confirmation", async () => {
    grant(["delivery.read", "delivery.partners.manage", "delivery.payouts.manage"]);
    const period = getCurrentSalaryPeriod();
    const posted: unknown[] = [];
    mockApi({
      "/admin/delivery-partners/partner-1": () => salaryPartner,
      "/admin/delivery-partners/partner-1/earnings": () => earnings,
      "/admin/delivery-partners/partner-1/ledger": ({ body }) => {
        posted.push(JSON.parse(body ?? "{}"));
        return ledgerEntry({});
      }
    });
    renderPage(<DeliveryPartnerDetailPage partnerId="partner-1" />);

    expect(await screen.findByText("Alpha Store (ALP)")).toBeInTheDocument();
    expect(screen.getAllByText("₹18,000 / month salary").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Edit partner" })).toHaveAttribute("href", "/delivery/partners/partner-1/edit");

    const panel = screen.getByRole("region", { name: "Earnings and payments" });
    await waitFor(() => expect(metricValue("Completed deliveries")).toBe("12"));
    expect(metricValue("Wallet balance")).toBe("₹1,000.00");
    expect(metricValue("Salary credited")).toBe("₹18,000.00");
    const history = within(panel).getByRole("table", { name: "Payment history" });
    expect(within(history).getByText("Salary month: September 2026")).toBeInTheDocument();
    expect(within(history).getByText("-₹18,000.00")).toBeInTheDocument();
    expect(within(history).getByText("Delivery commission")).toBeInTheDocument();
    expect(within(history).getByText("UPI-123")).toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText("Amount (₹)"), { target: { value: "5000" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Record payment" }));
    expect(await within(panel).findByText("A payout cannot exceed the wallet balance of ₹1,000.00.")).toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText("Entry type"), { target: { value: "SALARY" } });
    expect(within(panel).getByLabelText("Amount (₹)")).toHaveValue(18000);
    expect(within(panel).getByLabelText("Salary month")).toHaveValue(period);
    expect(within(panel).getByLabelText("Description")).toHaveValue(`Salary for ${formatSalaryPeriod(period)}`);
    fireEvent.change(within(panel).getByLabelText("Reference (optional)"), { target: { value: "SAL-1" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Record payment" }));

    expect(
      await screen.findByText(
        `Record a salary credit of ₹18,000.00 for ${formatSalaryPeriod(period)} for Asha Driver?`
      )
    ).toBeInTheDocument();
    expect(posted).toEqual([]);
    fireEvent.click(screen.getAllByRole("button", { name: "Record payment" }).at(-1)!);

    expect(await screen.findByText("Salary credit recorded.")).toBeInTheDocument();
    expect(posted).toEqual([
      {
        amount: 18000,
        description: `Salary for ${formatSalaryPeriod(period)}`,
        reference: "SAL-1",
        salaryPeriod: period,
        type: "SALARY"
      }
    ]);
  });

  it("warns about missing warehouses and hides pay actions without permission", async () => {
    grant(["delivery.read"]);
    mockApi({
      "/admin/delivery-partners/partner-2": () => applicant,
      "/admin/delivery-partners/partner-2/earnings": () => ({
        ...earnings,
        entries: [],
        payment: noPay,
        totals: { commissionEarnings: 0, completedDeliveries: 0, paidOut: 0, salaryEarnings: 0 },
        wallet: applicant.wallet
      })
    });
    renderPage(<DeliveryPartnerDetailPage partnerId="partner-2" />);

    expect(
      await screen.findByText("Assign at least one warehouse before dispatching orders to this partner.")
    ).toBeInTheDocument();
    expect(screen.getByText("Pay not set")).toBeInTheDocument();
    expect(await screen.findByText("No payments yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit partner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Entry type")).not.toBeInTheDocument();
  });

  it("offers salary credits only to salary-based partners", async () => {
    grant(["delivery.read", "delivery.payouts.manage"]);
    const commissionPartner = {
      ...salaryPartner,
      payment: { ...noPay, commissionType: "FIXED", commissionValue: 50, paymentType: "COMMISSION" }
    };
    mockApi({
      "/admin/delivery-partners/partner-1": () => commissionPartner,
      "/admin/delivery-partners/partner-1/earnings": () => ({ ...earnings, payment: commissionPartner.payment })
    });
    renderPage(<DeliveryPartnerDetailPage partnerId="partner-1" />);

    const entryType = await screen.findByLabelText("Entry type");
    const options = within(entryType).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Select", "Payout", "Earning adjustment"]);
    expect(screen.getAllByText("₹50 per delivery").length).toBeGreaterThan(0);
  });
});
