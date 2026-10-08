import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryPartnerCreatePage, DeliveryPartnerEditPage } from "./delivery-partner-form";

const access = vi.hoisted(() => ({
  permissions: new Set<string>(),
  push: vi.fn(),
  request: vi.fn(),
  role: "SUPER_ADMIN",
  search: ""
}));

vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({
    admin: { role: { code: access.role, name: access.role } },
    api: { request: access.request },
    hasPermission: (permission: string) => access.permissions.has(permission)
  })
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: access.push }),
  useSearchParams: () => new URLSearchParams(access.search)
}));
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

const MANAGE = "delivery.partners.manage";
const PAYOUTS = "delivery.payouts.manage";
const warehouse = (id: string, name: string, code: string) => ({
  address: "Plot 1",
  city: "Pune",
  code,
  contactNumber: "+919000000000",
  contactPerson: "Desk",
  id,
  name,
  pincode: "411001",
  state: "Maharashtra",
  status: "ACTIVE"
});
const alpha = warehouse("w-alpha", "Alpha Store", "ALP");
const beta = warehouse("w-beta", "Beta Store", "BET");
const gamma = warehouse("w-gamma", "Gamma Store", "GAM");
const list = (items: unknown[]) => ({
  items,
  pagination: { hasNextPage: false, hasPreviousPage: false, limit: 100, page: 1, total: items.length, totalPages: 1 }
});
const savedPartner = { id: "partner-1" };
const existingPartner = {
  createdAt: "2026-09-01T10:00:00.000Z",
  documents: [],
  email: "asha@example.com",
  fullName: "Asha Driver",
  id: "partner-1",
  isOnline: false,
  lastSeenAt: null,
  mobileNumber: "+919876543210",
  payment: { commissionType: null, commissionValue: null, monthlySalary: 18000, paymentType: "SALARY" },
  status: "ACTIVE",
  updatedAt: "2026-09-01T10:00:00.000Z",
  vehicleNumber: "MH12AB1234",
  wallet: { balance: 0, currency: "INR", totalEarnings: 0 },
  warehouses: [alpha, gamma]
};
const clients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  access.permissions.clear();
  access.push.mockReset();
  access.request.mockReset();
  access.role = "SUPER_ADMIN";
  access.search = "";
});

function signIn(role: string, permissions: string[]) {
  access.role = role;
  permissions.forEach((permission) => access.permissions.add(permission));
}

function mockApi(warehouses: unknown[], onSave: (path: string, body: unknown) => unknown = () => savedPartner) {
  access.request.mockImplementation(async (path: string, options: { body?: string; method?: string } = {}) => {
    if (options.method) {
      return onSave(path, JSON.parse(options.body ?? "{}"));
    }
    if (path === "/admin/warehouses") return list(warehouses);
    if (path === "/admin/delivery-partners/partner-1") return existingPartner;
    throw new Error(`Unexpected request: ${path}`);
  });
}

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function savedBody() {
  const call = access.request.mock.calls.find(([, options]) => options?.method);
  return call ? JSON.parse(call[1].body) : undefined;
}

describe("Add delivery partner", () => {
  it("lets a super admin choose several warehouses and set commission pay", async () => {
    signIn("SUPER_ADMIN", ["delivery.read", "warehouse.read", MANAGE, PAYOUTS]);
    access.search = `warehouseId=${beta.id}`;
    mockApi([alpha, beta]);
    renderPage(<DeliveryPartnerCreatePage />);

    expect(await screen.findByRole("checkbox", { name: "Beta Store (BET)" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Alpha Store (ALP)" })).not.toBeChecked();
    expect(access.request).toHaveBeenCalledWith("/admin/warehouses", { query: { limit: 100, page: 1, status: "ACTIVE" } });

    fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
    expect(await screen.findByText("Enter the partner's full name.")).toBeInTheDocument();
    expect(savedBody()).toBeUndefined();

    fill("Full name", " Asha Driver ");
    fill("Mobile number", "+91 98765 43210");
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha Store (ALP)" }));
    fireEvent.change(screen.getByLabelText("Pay type"), { target: { value: "COMMISSION" } });
    expect(screen.getByLabelText("Commission type")).toHaveValue("PERCENTAGE");
    fill("Commission (%)", "5");
    fireEvent.click(screen.getByRole("button", { name: "Add partner" }));

    await waitFor(() => expect(access.push).toHaveBeenCalledWith("/delivery/partners/partner-1"));
    expect(access.request).toHaveBeenCalledWith("/admin/delivery-partners", expect.objectContaining({ method: "POST" }));
    expect(savedBody()).toEqual({
      commissionType: "PERCENTAGE",
      commissionValue: 5,
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      paymentType: "COMMISSION",
      warehouseIds: ["w-beta", "w-alpha"]
    });
  });

  it("requires a super admin to pick at least one warehouse", async () => {
    signIn("SUPER_ADMIN", ["delivery.read", "warehouse.read", MANAGE, PAYOUTS]);
    mockApi([alpha, beta]);
    renderPage(<DeliveryPartnerCreatePage />);

    await screen.findByRole("checkbox", { name: "Alpha Store (ALP)" });
    fill("Full name", "Asha Driver");
    fill("Mobile number", "+919876543210");
    fireEvent.click(screen.getByRole("button", { name: "Add partner" }));

    expect(await screen.findByText("Select at least one warehouse.")).toBeInTheDocument();
    expect(savedBody()).toBeUndefined();
  });

  it("adds a partner to a warehouse manager's only warehouse without pay fields", async () => {
    signIn("WAREHOUSE_MANAGER", ["delivery.read", "warehouse.read", MANAGE]);
    mockApi([alpha]);
    renderPage(<DeliveryPartnerCreatePage />);

    const warehouses = await screen.findByRole("region", { name: "Warehouses" });
    expect(within(warehouses).getByText("Alpha Store (ALP)")).toBeInTheDocument();
    expect(within(warehouses).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pay type")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pay" })).not.toBeInTheDocument();

    fill("Full name", "Ravi Rider");
    fill("Mobile number", "+919111111111");
    fill("Vehicle number (optional)", " mh12ab1234 ");
    fireEvent.click(screen.getByRole("button", { name: "Add partner" }));

    await waitFor(() => expect(access.push).toHaveBeenCalledWith("/delivery/partners/partner-1"));
    expect(savedBody()).toStrictEqual({
      fullName: "Ravi Rider",
      mobileNumber: "+919111111111",
      vehicleNumber: "MH12AB1234",
      warehouseIds: ["w-alpha"]
    });
  });

  it("asks staff with several warehouses to pick exactly one", async () => {
    signIn("WAREHOUSE_MANAGER", ["delivery.read", "warehouse.read", MANAGE]);
    mockApi([alpha, beta]);
    renderPage(<DeliveryPartnerCreatePage />);

    await screen.findByLabelText("Warehouse");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fill("Full name", "Ravi Rider");
    fill("Mobile number", "+919111111111");
    fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
    expect(await screen.findByText("Select the warehouse this partner works from.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Warehouse"), { target: { value: beta.id } });
    fireEvent.click(screen.getByRole("button", { name: "Add partner" }));
    await waitFor(() => expect(savedBody()).toStrictEqual({
      fullName: "Ravi Rider",
      mobileNumber: "+919111111111",
      warehouseIds: ["w-beta"]
    }));
  });

  it("shows access restricted without the partner management permission", () => {
    signIn("SUPPORT", ["delivery.read", "warehouse.read"]);
    mockApi([alpha]);
    renderPage(<DeliveryPartnerCreatePage />);

    expect(screen.getByText("Access restricted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add partner" })).not.toBeInTheDocument();
    expect(access.request).not.toHaveBeenCalled();
  });
});

describe("Edit delivery partner", () => {
  it("keeps warehouses and pay read-only for warehouse staff and never sends them", async () => {
    signIn("WAREHOUSE_MANAGER", ["delivery.read", "warehouse.read", MANAGE]);
    let attempts = 0;
    mockApi([alpha], () => {
      attempts += 1;
      if (attempts === 1) throw new Error("A delivery partner with this mobile number or email already exists.");
      return savedPartner;
    });
    renderPage(<DeliveryPartnerEditPage partnerId="partner-1" />);

    expect(await screen.findByLabelText("Full name")).toHaveValue("Asha Driver");
    const warehouses = screen.getByRole("region", { name: "Warehouses" });
    expect(within(warehouses).getByText("Alpha Store (ALP)")).toBeInTheDocument();
    expect(within(warehouses).getByText("Gamma Store (GAM)")).toBeInTheDocument();
    expect(within(warehouses).getByText(/Only admins with access to every warehouse/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Pay" })).getByText("₹18,000 / month salary")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pay type")).not.toBeInTheDocument();
    expect(access.request).not.toHaveBeenCalledWith("/admin/warehouses", expect.anything());

    fill("Full name", "Asha R");
    fill("Email (optional)", "");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A delivery partner with this mobile number or email already exists."
    );
    expect(screen.getByLabelText("Full name")).toHaveValue("Asha R");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(access.push).toHaveBeenCalledWith("/delivery/partners/partner-1"));
    expect(access.request).toHaveBeenCalledWith(
      "/admin/delivery-partners/partner-1",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(savedBody()).toStrictEqual({
      email: null,
      fullName: "Asha R",
      mobileNumber: "+919876543210",
      vehicleNumber: "MH12AB1234"
    });
  });

  it("lets a super admin replace warehouses, keeping an inactive linked warehouse visible", async () => {
    signIn("SUPER_ADMIN", ["delivery.read", "warehouse.read", MANAGE, PAYOUTS]);
    mockApi([alpha, beta]);
    renderPage(<DeliveryPartnerEditPage partnerId="partner-1" />);

    expect(await screen.findByRole("checkbox", { name: "Gamma Store (GAM)" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Alpha Store (ALP)" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beta Store (BET)" })).not.toBeChecked();
    expect(screen.getByLabelText("Pay type")).toHaveValue("SALARY");
    expect(within(screen.getByLabelText("Pay type")).queryByRole("option", { name: "Not set yet" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Monthly salary (₹)")).toHaveValue(18000);

    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha Store (ALP)" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Beta Store (BET)" }));
    fill("Monthly salary (₹)", "20000");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(savedBody()).toStrictEqual({
      email: "asha@example.com",
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      monthlySalary: 20000,
      paymentType: "SALARY",
      vehicleNumber: "MH12AB1234",
      warehouseIds: ["w-gamma", "w-beta"]
    }));
  });
});
