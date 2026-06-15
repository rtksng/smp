import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerAddress, CustomerProfileDetails } from "../../lib/api/customer-profile";
import type { Order } from "../../lib/api/orders";
import { AccountOverview } from "./account-overview";

const mocks = vi.hoisted(() => ({
  getCustomerProfile: vi.fn(),
  listCustomerAddresses: vi.fn(),
  listCustomerOrders: vi.fn(),
  logout: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useRouter: () => ({
    replace: vi.fn()
  })
}));

vi.mock("../auth/protected-customer-route", () => ({
  ProtectedCustomerRoute: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  )
}));

vi.mock("../layout/header", () => ({
  Header: () => <header data-testid="header" />
}));

vi.mock("../layout/footer", () => ({
  Footer: () => <footer data-testid="footer" />
}));

vi.mock("../../lib/stores/auth-store", () => ({
  useCustomerAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      logout: mocks.logout,
      session: {
        customer: {
          email: "session@example.com",
          firstName: "Asha",
          id: "customer_1",
          lastName: null,
          mobileNumber: "+919800000001"
        },
        tokens: {
          accessToken: "access",
          accessTokenExpiresAt: "2026-06-14T10:00:00.000Z",
          accessTokenExpiresInSeconds: 3600,
          refreshToken: "refresh",
          refreshTokenExpiresAt: "2026-06-21T10:00:00.000Z",
          refreshTokenExpiresInSeconds: 604800,
          tokenType: "Bearer"
        }
      }
    })
}));

vi.mock("../../lib/api/customer-profile", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/api/customer-profile")
  >("../../lib/api/customer-profile");

  return {
    ...actual,
    getCustomerProfile: mocks.getCustomerProfile,
    listCustomerAddresses: mocks.listCustomerAddresses
  };
});

vi.mock("../../lib/api/orders", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/orders")>(
    "../../lib/api/orders"
  );

  return {
    ...actual,
    listCustomerOrders: mocks.listCustomerOrders
  };
});

const profile: CustomerProfileDetails = {
  businessName: "Rao Medical Supplies",
  email: "billing@example.com",
  gstNumber: "27ABCDE1234F1Z5",
  id: "customer_1",
  mobileNumber: "+919876543210",
  name: "Dr Asha Rao"
};

const address: CustomerAddress = {
  addressLine1: "12 Surgical Street",
  addressLine2: "Suite 4",
  city: "Mumbai",
  createdAt: "2026-06-01T00:00:00.000Z",
  fullName: "Asha Clinic",
  id: "address_1",
  isDefault: true,
  landmark: "Near metro",
  latitude: null,
  longitude: null,
  phone: "+919876543210",
  pincode: "400001",
  state: "Maharashtra",
  type: "CLINIC",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

const order: Order = {
  createdAt: "2026-06-02T10:00:00.000Z",
  id: "order_1",
  items: [
    {
      id: "item_1",
      name: "Curved Artery Forceps",
      productId: "product_1",
      quantity: 2,
      sku: "FORCEPS-001",
      stockBatchId: null,
      taxAmount: 50.4,
      taxRate: 18,
      total: 330.4,
      unitPrice: 140,
      variantId: null,
      warehouseId: null
    }
  ],
  orderNumber: "ORD-20260602-ABC12345",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  placedAt: "2026-06-02T10:00:00.000Z",
  shippingAddress: {
    city: "Mumbai",
    country: "India",
    fullName: "Asha Clinic",
    id: "address_1",
    line1: "12 Surgical Street",
    line2: "Suite 4",
    mobileNumber: "+919876543210",
    pincode: "400001",
    state: "Maharashtra"
  },
  status: "CONFIRMED",
  statusHistory: [],
  totals: {
    deliveryCharge: 50,
    discount: 0,
    grandTotal: 380.4,
    subtotal: 280,
    tax: 50.4
  },
  updatedAt: "2026-06-02T10:00:00.000Z",
  warehouseId: null
};

describe("AccountOverview", () => {
  beforeEach(() => {
    mocks.getCustomerProfile.mockReset();
    mocks.listCustomerAddresses.mockReset();
    mocks.listCustomerOrders.mockReset();
    mocks.logout.mockReset();
    mocks.getCustomerProfile.mockResolvedValue(profile);
    mocks.listCustomerAddresses.mockResolvedValue([address]);
    mocks.listCustomerOrders.mockResolvedValue({
      items: [order],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 3,
        page: 1,
        total: 1,
        totalPages: 1
      }
    });
  });

  it("renders dynamic account, address, and order summaries with compact hierarchy", async () => {
    renderAccountOverview();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Account overview" })
    ).toHaveClass("text-2xl");
    expect((await screen.findAllByText("Dr Asha Rao")).length).toBeGreaterThan(0);
    expect(screen.getByText("Rao Medical Supplies")).toBeInTheDocument();
    expect(screen.getByText("1 saved address")).toBeInTheDocument();
    expect(screen.getByText("Asha Clinic")).toBeInTheDocument();
    expect(screen.getByText("ORD-20260602-ABC12345")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("₹380.40")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage addresses" })).toHaveAttribute(
      "href",
      "/account/addresses"
    );
    expect(screen.getByRole("link", { name: "View all orders" })).toHaveAttribute(
      "href",
      "/account/orders"
    );
  });
});

function renderAccountOverview() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AccountOverview />
    </QueryClientProvider>
  );
}
