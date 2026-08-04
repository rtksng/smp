import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "../../lib/api/schemas";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { Header } from "./header";

const mocks = vi.hoisted(() => ({
  getCart: vi.fn(),
  getCategories: vi.fn()
}));

vi.mock("../../lib/api/cart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api/cart")>()),
  getCart: mocks.getCart
}));

vi.mock("../../lib/api/categories", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api/categories")>()),
  getCategories: mocks.getCategories
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe("Header", () => {
  beforeEach(() => {
    mocks.getCart.mockReset();
    mocks.getCart.mockResolvedValue({
      id: "cart_test",
      itemCount: 0,
      items: [],
      totalQuantity: 0,
      totals: {
        discountAmount: 0,
        grandTotal: 0,
        shippingAmount: 0,
        subtotal: 0,
        taxAmount: 0
      },
      updatedAt: "2026-08-03T00:00:00.000Z"
    });
    mocks.getCategories.mockReset();
    mocks.getCategories.mockResolvedValue([]);
    useCustomerAuthStore.setState(useCustomerAuthStore.getInitialState(), true);
  });

  it("stays fixed at the top of the viewport on every screen", () => {
    renderHeader(<Header />);

    expect(screen.getByRole("banner")).toHaveClass(
      "fixed",
      "inset-x-0",
      "top-0"
    );
    expect(screen.getByTestId("header-fixed-spacer")).toHaveClass("h-[6.5rem]");
  });

  it("opens desktop categories on hover and closes when hover leaves", async () => {
    mocks.getCategories.mockResolvedValue([
      category("consumables", "Consumables", [
        category("surgical-gloves", "Surgical Gloves")
      ]),
      category("diagnostics", "Diagnostics", [
        category("bp-monitors", "BP Monitors")
      ]),
      ...Array.from({ length: 11 }, (_, index) =>
        category(`future-department-${index + 1}`, `Future department ${index + 1}`)
      )
    ]);
    renderHeader(<Header />);

    const menu = screen.getByTestId("desktop-category-menu");
    expect(screen.queryByText("Departments")).not.toBeInTheDocument();

    fireEvent.mouseEnter(menu);

    expect(await screen.findByText("Departments")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-department-list")).toHaveClass(
      "overflow-y-auto"
    );
    expect(
      await screen.findByRole("link", { name: "Future department 11" })
    ).toHaveAttribute("href", "/categories/future-department-11");
    expect(
      (await screen.findAllByRole("link", { name: "Diagnostics" }))[0]
    ).toHaveAttribute("href", "/categories/diagnostics");

    expect(
      await screen.findByRole("link", { name: "Surgical Gloves" })
    ).toHaveAttribute("href", "/categories/consumables/surgical-gloves");

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Diagnostics" }));

    expect(screen.getByRole("link", { name: "BP Monitors" })).toHaveAttribute(
      "href",
      "/categories/diagnostics/bp-monitors"
    );
    expect(
      screen.queryByRole("link", { name: "Surgical Gloves" })
    ).not.toBeInTheDocument();

    fireEvent.mouseLeave(menu);

    await waitFor(() => {
      expect(screen.queryByText("Departments")).not.toBeInTheDocument();
    });
  });

  it("keeps logout out of the header when a customer is signed in", async () => {
    useCustomerAuthStore.setState({
      session: customerSession()
    });

    renderHeader(<Header />);

    expect(await screen.findByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account/profile"
    );
    expect(screen.getByRole("link", { name: "Open account" })).toHaveAttribute(
      "href",
      "/account"
    );
    expect(screen.queryByRole("button", { name: /logout/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Logout")).not.toBeInTheDocument();
  });
});

function category(
  slug: string,
  name: string,
  children: Category[] = []
): Category {
  return {
    children,
    description: null,
    id: slug,
    imageUrl: null,
    isActive: true,
    name,
    parentId: null,
    slug,
    sortOrder: 0
  };
}

function customerSession() {
  return {
    customer: {
      email: "asha@example.com",
      firstName: "Asha",
      id: "customer_1",
      lastName: "Singh",
      mobileNumber: "+919800000001"
    },
    tokens: {
      accessToken: "access-token",
      accessTokenExpiresAt: "2026-08-03T01:00:00.000Z",
      accessTokenExpiresInSeconds: 3600,
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: "2026-08-10T00:00:00.000Z",
      refreshTokenExpiresInSeconds: 604800,
      tokenType: "Bearer" as const
    }
  };
}

function renderHeader(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}
