import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider } from "@heroui/system";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomerDetailPage from "../[id]/page";
import { CustomersLandingPage } from "./customer-sections";
import type { AdminCustomerDetail } from "../../../lib/customer-management";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  request: vi.fn()
}));

vi.mock("../../../lib/admin-session", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAdminSession: () => ({ api: { request: mocks.request }, hasPermission: mocks.hasPermission })
}));

vi.mock("../../admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "customer-1" })
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
    "aria-label": label
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    "aria-label"?: string;
  }) => (
    <select
      aria-label={label}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
      value={value}
    >
      <option value="">Select</option>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null
}));

const customer: AdminCustomerDetail = {
  addressCount: 1,
  addresses: [
    {
      city: "Delhi",
      country: "India",
      fullName: "Asha Singh",
      id: "address-1",
      isDefault: true,
      line1: "Clinic Road",
      line2: null,
      mobileNumber: "9876543210",
      pincode: "110001",
      state: "Delhi",
      type: "WORK"
    }
  ],
  businessName: "Asha Clinic",
  createdAt: "2026-09-01T10:00:00.000Z",
  email: "asha@example.com",
  gstNumber: "07ABCDE1234F1Z5",
  id: "customer-1",
  isActive: true,
  mobileNumber: "9876543210",
  name: "Asha Singh",
  orderCount: 1,
  orders: [
    {
      createdAt: "2026-09-02T10:00:00.000Z",
      grandTotal: 590,
      id: "order-1",
      orderNumber: "ORD-1",
      paymentStatus: "PAID",
      placedAt: "2026-09-02T10:00:00.000Z",
      status: "DELIVERED"
    }
  ],
  status: "ACTIVE",
  supportNotes: [],
  updatedAt: "2026-09-02T10:00:00.000Z"
};

const clients: QueryClient[] = [];

function paginated() {
  return {
    items: [customer],
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      limit: 20,
      page: 1,
      total: 1,
      totalPages: 1
    }
  };
}

function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
  clients.push(client);
  return render(
    <HeroUIProvider disableAnimation>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </HeroUIProvider>
  );
}

beforeEach(() => {
  mocks.hasPermission.mockReset().mockReturnValue(true);
  mocks.request.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/admin/customers") return paginated();
    if (path === "/admin/customers/customer-1/notes") {
      return { adminName: "QA Admin", createdAt: customer.createdAt, id: "note-1", note: "Follow up" };
    }
    if (path === "/admin/customers/customer-1/status") {
      customer.status = JSON.parse(String(init?.body)).status;
      customer.isActive = customer.status === "ACTIVE";
      return { ...customer };
    }
    if (path === "/admin/customers/customer-1") return { ...customer };
    throw new Error(`Unexpected request: ${path}`);
  });
});

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  customer.status = "ACTIVE";
  customer.isActive = true;
});

describe("Customers admin flows", () => {
  it("applies list filters and processes a reviewed bulk status update", async () => {
    mount(<CustomersLandingPage />);
    expect(await screen.findByText("Asha Singh")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    const drawer = await screen.findByRole("dialog", { name: "Customer filters" });
    fireEvent.change(within(drawer).getByLabelText("Search"), {
      target: { value: " Asha " }
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith("/admin/customers", {
        query: expect.objectContaining({ page: 1, search: "Asha" })
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Customer filters" })).toBeNull()
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select current page" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Bulk action" }), {
      target: { value: "BLOCKED" }
    });
    fireEvent.change(screen.getByLabelText("Account status note"), {
      target: { value: "Needs review" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Review selected" }));
    fireEvent.click(await screen.findByRole("button", { name: "Process 1 record" }));

    expect(await screen.findByRole("heading", { name: "Processing results" })).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      "/admin/customers/customer-1/status",
      { body: JSON.stringify({ note: "Needs review", status: "BLOCKED" }), method: "PATCH" }
    );
  });

  it("keeps customer detail status and support-note actions functional", async () => {
    mount(<CustomerDetailPage />);
    expect(await screen.findByRole("heading", { name: "Asha Singh" })).toBeInTheDocument();
    expect(screen.getByText("Clinic Road")).toBeInTheDocument();
    expect(screen.getByText("ORD-1")).toBeInTheDocument();

    const statusSelect = screen.getByRole("combobox", { name: "Customer status" });
    fireEvent.change(statusSelect, {
      target: { value: "BLOCKED" }
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Fraud review" }
    });
    const statusForm = statusSelect.closest("form");
    expect(statusForm).not.toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Update status" })).toBeEnabled()
    );
    fireEvent.submit(statusForm!);
    const confirmationTitle = await screen.findByText("Confirm customer status");
    const confirmation = confirmationTitle.closest('[role="dialog"]');
    expect(confirmation).not.toBeNull();
    fireEvent.click(
      within(confirmation as HTMLElement).getByRole("button", { name: "Update status" })
    );
    expect(await screen.findByText("Customer status updated.")).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      "/admin/customers/customer-1/status",
      { body: JSON.stringify({ note: "Fraud review", status: "BLOCKED" }), method: "PATCH" }
    );

    fireEvent.change(screen.getByLabelText("New note"), {
      target: { value: " Follow up " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByText("Support note added.")).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      "/admin/customers/customer-1/notes",
      { body: JSON.stringify({ note: "Follow up" }), method: "POST" }
    );
  });
});
