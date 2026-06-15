import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import type { CustomerAddress } from "../../lib/api/customer-profile";
import type { Order } from "../../lib/api/orders";
import { CheckoutPage } from "./checkout-page";

const mocks = vi.hoisted(() => ({
  createCustomerAddress: vi.fn(),
  createOrder: vi.fn(),
  getPaymentGatewayStatus: vi.fn(),
  getCart: vi.fn(),
  listCustomerAddresses: vi.fn(),
  routerReplace: vi.fn(),
  updateCustomerAddress: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/checkout",
  useRouter: () => ({
    replace: mocks.routerReplace
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

vi.mock("../../lib/api/cart", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/cart")>(
    "../../lib/api/cart"
  );

  return {
    ...actual,
    getCart: mocks.getCart
  };
});

vi.mock("../../lib/api/customer-profile", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/api/customer-profile")
  >("../../lib/api/customer-profile");

  return {
    ...actual,
    createCustomerAddress: mocks.createCustomerAddress,
    listCustomerAddresses: mocks.listCustomerAddresses,
    updateCustomerAddress: mocks.updateCustomerAddress
  };
});

vi.mock("../../lib/api/orders", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/orders")>(
    "../../lib/api/orders"
  );

  return {
    ...actual,
    createOrder: mocks.createOrder
  };
});

vi.mock("../../lib/api/payments", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/payments")>(
    "../../lib/api/payments"
  );

  return {
    ...actual,
    getPaymentGatewayStatus: mocks.getPaymentGatewayStatus
  };
});

vi.mock("../../lib/checkout/razorpay", () => ({
  openRazorpayCheckout: vi.fn()
}));

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

const cart: Cart = {
  id: "cart_1",
  itemCount: 1,
  items: [
    {
      availableQuantity: 8,
      brand: {
        id: "brand_1",
        name: "SurgiPro",
        slug: "surgipro"
      },
      category: {
        id: "category_1",
        name: "Surgical Instruments",
        slug: "surgical-instruments"
      },
      createdAt: "2026-06-01T00:00:00.000Z",
      id: "cart_item_1",
      imageUrl:
        "http://localhost:4000/uploads/catalog/products/images/forceps.png",
      isAvailable: true,
      name: "SurgiPro Artery Forceps",
      productId: "product_1",
      productStatus: "ACTIVE",
      quantity: 2,
      sku: "SP-FOR-10",
      slug: "surgipro-artery-forceps",
      subcategory: {
        id: "subcategory_1",
        name: "Forceps",
        slug: "forceps"
      },
      subtotal: 1000,
      tax: 180,
      taxRate: 18,
      total: 1180,
      unitPrice: 500,
      updatedAt: "2026-06-01T00:00:00.000Z",
      variantId: "variant_1",
      variantName: "Box of 10",
      variantStatus: "ACTIVE"
    }
  ],
  totalQuantity: 2,
  totals: {
    deliveryCharge: 50,
    discount: 20,
    grandTotal: 1210,
    subtotal: 1000,
    tax: 180
  },
  updatedAt: "2026-06-01T00:00:00.000Z"
};

const order: Order = {
  createdAt: "2026-06-01T00:00:00.000Z",
  id: "order_1",
  items: [],
  orderNumber: "ORD-20260601-ABC12345",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  placedAt: "2026-06-01T00:00:00.000Z",
  shippingAddress: null,
  status: "CREATED",
  statusHistory: [],
  totals: cart.totals,
  updatedAt: "2026-06-01T00:00:00.000Z",
  warehouseId: null
};

describe("CheckoutPage", () => {
  beforeEach(() => {
    mocks.createCustomerAddress.mockReset();
    mocks.createOrder.mockReset();
    mocks.getPaymentGatewayStatus.mockReset();
    mocks.getCart.mockReset();
    mocks.listCustomerAddresses.mockReset();
    mocks.routerReplace.mockReset();
    mocks.updateCustomerAddress.mockReset();
    mocks.getCart.mockResolvedValue(cart);
    mocks.listCustomerAddresses.mockResolvedValue([address]);
    mocks.createOrder.mockResolvedValue(order);
    mocks.getPaymentGatewayStatus.mockResolvedValue({
      message: "Payment gateway is not configured yet.",
      onlinePaymentEnabled: false,
      provider: "razorpay"
    });
  });

  it("renders dynamic cart totals and validates required address fields", async () => {
    mocks.listCustomerAddresses.mockResolvedValue([]);

    renderCheckout();

    expect(await screen.findByRole("heading", { name: "Cart review" }))
      .toBeInTheDocument();
    expect(screen.getByText("SurgiPro Artery Forceps")).toBeInTheDocument();
    expect(
      screen.getByAltText("SurgiPro Artery Forceps product image")
    ).toHaveAttribute("src", cart.items[0]?.imageUrl);
    expect(screen.getByText("Amount payable")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,210.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add address" }));
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Address line 1 is required.")).toBeInTheDocument();
    expect(screen.getByText("City is required.")).toBeInTheDocument();
    expect(screen.getByText("State is required.")).toBeInTheDocument();
    expect(screen.getByText("Enter a 6 digit pincode.")).toBeInTheDocument();
    expect(
      screen.getByText("Use an E.164 phone number, for example +919876543210.")
    ).toBeInTheDocument();
  });

  it("edits a saved checkout address through the inline form", async () => {
    mocks.updateCustomerAddress.mockResolvedValue({
      ...address,
      city: "Pune"
    });

    renderCheckout();

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("City"), {
      target: {
        value: "Pune"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update address" }));

    await waitFor(() => {
      expect(mocks.updateCustomerAddress).toHaveBeenCalledWith("address_1", {
        addressLine1: "12 Surgical Street",
        addressLine2: "Suite 4",
        city: "Pune",
        fullName: "Asha Clinic",
        landmark: "Near metro",
        phone: "+919876543210",
        pincode: "400001",
        state: "Maharashtra",
        type: "CLINIC"
      });
    });
    expect(await screen.findByText("Address updated.")).toBeInTheDocument();
  });

  it("places a COD order with selected address and cart totals", async () => {
    renderCheckout();

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Place COD order" }));

    await waitFor(() => {
      expect(mocks.createOrder).toHaveBeenCalledWith({
        billingAddressId: null,
        paymentMethod: "COD",
        shippingAddressId: "address_1"
      });
    });
    expect(mocks.routerReplace).toHaveBeenCalledWith("/order-success/order_1");
  });

  it("marks online payment unavailable without creating an order or clearing checkout", async () => {
    renderCheckout();

    expect(await screen.findByText("Asha Clinic")).toBeInTheDocument();

    const onlinePaymentButton = await screen.findByRole("button", {
      name: /Online payment/i
    });

    expect(onlinePaymentButton).toBeDisabled();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(
      screen.getAllByText("Payment gateway is not configured yet.").length
    ).toBeGreaterThan(0);

    fireEvent.click(onlinePaymentButton);

    expect(
      screen.getByRole("button", { name: "Place COD order" })
    ).toBeInTheDocument();
    expect(screen.getByText("SurgiPro Artery Forceps")).toBeInTheDocument();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.routerReplace).not.toHaveBeenCalledWith(
      expect.stringContaining("/payment-failed")
    );
  });
});

function renderCheckout() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutPage />
    </QueryClientProvider>
  );
}
