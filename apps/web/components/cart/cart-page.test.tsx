import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import { CartPage } from "./cart-page";

const mocks = vi.hoisted(() => ({
  clearCart: vi.fn(),
  getCart: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn()
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
    clearCart: mocks.clearCart,
    getCart: mocks.getCart,
    removeCartItem: mocks.removeCartItem,
    updateCartItem: mocks.updateCartItem
  };
});

describe("CartPage", () => {
  beforeEach(() => {
    mocks.clearCart.mockReset();
    mocks.getCart.mockReset();
    mocks.removeCartItem.mockReset();
    mocks.updateCartItem.mockReset();
    mocks.getCart.mockResolvedValue(cartWithItem());
    mocks.updateCartItem.mockResolvedValue(cartWithItem(3));
  });

  it("renders dynamic product details and optimistically updates totals", async () => {
    let resolveUpdate: (cart: Cart) => void = () => undefined;
    const pendingUpdate = new Promise<Cart>((resolve) => {
      resolveUpdate = resolve;
    });

    mocks.updateCartItem.mockReturnValue(pendingUpdate);

    renderCart();

    expect(await screen.findByText("Curved Artery Forceps")).toBeInTheDocument();
    expect(screen.getByText("SurgiPro")).toBeInTheDocument();
    expect(screen.getByText("Surgical Instruments")).toBeInTheDocument();
    expect(screen.getByText("6 inch")).toBeInTheDocument();
    expect(
      screen.getByAltText("Curved Artery Forceps product image")
    ).toHaveAttribute("src", "https://cdn.example.com/forceps.jpg");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Increase quantity for Curved Artery Forceps"
      })
    );

    await waitFor(() => {
      expect(mocks.updateCartItem).toHaveBeenCalledWith("cart_item_1", 3);
    });
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getAllByText((content) => content.includes("495.60")).length
    ).toBeGreaterThan(0);

    resolveUpdate(cartWithItem(3));
  });

  it("renders the empty cart state with a shopping CTA", async () => {
    mocks.getCart.mockResolvedValue(emptyCart());

    renderCart();

    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue shopping" })
    ).toHaveAttribute("href", "/products");
  });
});

function renderCart() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CartPage />
    </QueryClientProvider>
  );
}

function cartWithItem(quantity = 2): Cart {
  const subtotal = 140 * quantity;
  const tax = Math.round(subtotal * 18) / 100;
  const total = subtotal + tax;

  return {
    id: "cart_1",
    itemCount: 1,
    items: [
      {
        availableQuantity: 10,
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
        createdAt: "2026-05-25T10:00:00.000Z",
        id: "cart_item_1",
        imageUrl: "https://cdn.example.com/forceps.jpg",
        isAvailable: true,
        name: "Curved Artery Forceps",
        productId: "product_1",
        productStatus: "ACTIVE",
        quantity,
        sku: "FORCEPS-001-6IN",
        slug: "curved-artery-forceps",
        subcategory: {
          id: "subcategory_1",
          name: "Forceps",
          slug: "forceps"
        },
        subtotal,
        tax,
        taxRate: 18,
        total,
        unitPrice: 140,
        updatedAt: "2026-05-25T10:00:00.000Z",
        variantId: "variant_1",
        variantName: "6 inch",
        variantStatus: "ACTIVE"
      }
    ],
    totalQuantity: quantity,
    totals: {
      deliveryCharge: 0,
      discount: 0,
      grandTotal: total,
      subtotal,
      tax
    },
    updatedAt: "2026-05-25T10:00:00.000Z"
  };
}

function emptyCart(): Cart {
  return {
    id: "cart_1",
    itemCount: 0,
    items: [],
    totalQuantity: 0,
    totals: {
      deliveryCharge: 0,
      discount: 0,
      grandTotal: 0,
      subtotal: 0,
      tax: 0
    },
    updatedAt: "2026-05-25T10:00:00.000Z"
  };
}
