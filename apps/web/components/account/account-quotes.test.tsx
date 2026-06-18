import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import type { QuoteRequest } from "../../lib/api/quote-requests";
import { AccountQuotes } from "./account-quotes";

const mocks = vi.hoisted(() => ({
  acceptQuoteRequest: vi.fn(),
  convertQuoteToCart: vi.fn(),
  convertQuoteToOrder: vi.fn(),
  listCustomerQuoteRequests: vi.fn(),
  logout: vi.fn(),
  rejectQuoteRequest: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  setCartSummary: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace
  })
}));

vi.mock("../auth/protected-customer-route", () => ({
  ProtectedCustomerRoute: ({ children }: { children: ReactNode }) => <>{children}</>
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

vi.mock("../../lib/stores/cart-store", () => ({
  useCartStore: (selector: (state: unknown) => unknown) =>
    selector({
      setSummary: mocks.setCartSummary
    })
}));

vi.mock("../../lib/api/quote-requests", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/quote-requests")>(
    "../../lib/api/quote-requests"
  );

  return {
    ...actual,
    acceptQuoteRequest: mocks.acceptQuoteRequest,
    convertQuoteToCart: mocks.convertQuoteToCart,
    convertQuoteToOrder: mocks.convertQuoteToOrder,
    listCustomerQuoteRequests: mocks.listCustomerQuoteRequests,
    rejectQuoteRequest: mocks.rejectQuoteRequest
  };
});

const quotedRequest = accountQuote({ status: "QUOTED" });
const cart: Cart = {
  id: "cart_1",
  itemCount: 1,
  items: [],
  totalQuantity: 2,
  totals: {
    deliveryCharge: 0,
    discount: 0,
    grandTotal: 330.4,
    subtotal: 280,
    tax: 50.4
  },
  updatedAt: "2026-06-02T10:00:00.000Z"
};

describe("AccountQuotes", () => {
  const asyncUiTimeout = { timeout: 5000 };

  beforeEach(() => {
    mocks.acceptQuoteRequest.mockReset();
    mocks.convertQuoteToCart.mockReset();
    mocks.convertQuoteToOrder.mockReset();
    mocks.listCustomerQuoteRequests.mockReset();
    mocks.logout.mockReset();
    mocks.rejectQuoteRequest.mockReset();
    mocks.routerPush.mockReset();
    mocks.routerReplace.mockReset();
    mocks.setCartSummary.mockReset();
    mocks.acceptQuoteRequest.mockResolvedValue(accountQuote({ status: "ACCEPTED" }));
    mocks.convertQuoteToCart.mockResolvedValue({
      cart,
      quote: accountQuote({
        convertedCartId: "cart_1",
        status: "CONVERTED"
      })
    });
    mocks.convertQuoteToOrder.mockResolvedValue({
      order: {
        id: "order_1"
      },
      quote: accountQuote({
        convertedOrderId: "order_1",
        status: "CONVERTED"
      })
    });
    mocks.listCustomerQuoteRequests.mockResolvedValue({
      items: [quotedRequest],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 1,
        totalPages: 1
      }
    });
    mocks.rejectQuoteRequest.mockResolvedValue(accountQuote({ status: "REJECTED" }));
  });

  it("shows a quoted response and lets the customer accept or reject it", async () => {
    renderAccountQuotes();

    expect(
      await screen.findByText("Curved Artery Forceps", undefined, asyncUiTimeout)
    ).toBeInTheDocument();
    expect(screen.getAllByText("Awaiting decision").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Accept quote" }));

    await waitFor(() => {
      expect(mocks.acceptQuoteRequest).toHaveBeenCalledWith("quote_1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(mocks.rejectQuoteRequest).toHaveBeenCalledWith("quote_1");
    });
  });

  it("prepares the cart from an accepted quote and routes to cart review", async () => {
    mocks.listCustomerQuoteRequests.mockResolvedValue({
      items: [
        accountQuote({
          customerDecision: {
            decidedAt: "2026-06-03T10:00:00.000Z",
            note: null,
            status: "ACCEPTED"
          },
          status: "ACCEPTED"
        })
      ],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 1,
        totalPages: 1
      }
    });

    renderAccountQuotes();

    fireEvent.click(
      await screen.findByRole("button", { name: "Prepare cart" }, asyncUiTimeout)
    );

    await waitFor(() => {
      expect(mocks.convertQuoteToCart).toHaveBeenCalledWith("quote_1");
    });
    expect(mocks.setCartSummary).toHaveBeenCalledWith(cart);
    expect(mocks.routerPush).toHaveBeenCalledWith("/cart");
  });

  it("creates an order from an accepted custom quote and routes to order detail", async () => {
    mocks.listCustomerQuoteRequests.mockResolvedValue({
      items: [
        accountQuote({
          customerDecision: {
            decidedAt: "2026-06-03T10:00:00.000Z",
            note: null,
            status: "ACCEPTED"
          },
          quotation: {
            items: [
              {
                lineSubtotal: 500,
                lineTotal: 590,
                name: "Custom sterile draping kit",
                productId: null,
                quantity: 1,
                sku: "CUSTOM-DRAPE-001",
                taxAmount: 90,
                taxRate: 18,
                unitPrice: 500,
                variantId: null
              }
            ],
            notes: "Custom kit built to requested dimensions.",
            respondedAt: "2026-06-02T12:00:00.000Z",
            totals: {
              grandTotal: 640,
              shippingTotal: 50,
              subtotal: 500,
              taxTotal: 90
            },
            validUntil: "2026-06-30"
          },
          status: "ACCEPTED"
        })
      ],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 1,
        totalPages: 1
      }
    });

    renderAccountQuotes();

    fireEvent.click(
      await screen.findByRole("button", { name: "Create order" }, asyncUiTimeout)
    );

    await waitFor(() => {
      expect(mocks.convertQuoteToOrder).toHaveBeenCalledWith("quote_1");
    });
    expect(mocks.setCartSummary).not.toHaveBeenCalled();
    expect(mocks.routerPush).toHaveBeenCalledWith("/account/orders/order_1");
  });
});

function renderAccountQuotes() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false
      },
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AccountQuotes />
    </QueryClientProvider>
  );
}

function accountQuote(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    convertedCartId: null,
    convertedOrderId: null,
    createdAt: "2026-06-02T10:00:00.000Z",
    customerDecision: null,
    email: "asha@example.com",
    id: "quote_1",
    message: "Need forceps for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: "Asha Surgical Clinic",
    quotation: {
      items: [
        {
          lineSubtotal: 280,
          lineTotal: 330.4,
          name: "Curved Artery Forceps",
          productId: "product_1",
          quantity: 2,
          sku: "FORCEPS-001",
          taxAmount: 50.4,
          taxRate: 18,
          unitPrice: 140,
          variantId: null
        }
      ],
      notes: "Prices valid for current stock.",
      respondedAt: "2026-06-02T12:00:00.000Z",
      totals: {
        grandTotal: 330.4,
        shippingTotal: 0,
        subtotal: 280,
        taxTotal: 50.4
      },
      validUntil: "2026-06-30"
    },
    status: "QUOTED",
    ...overrides
  };
}
