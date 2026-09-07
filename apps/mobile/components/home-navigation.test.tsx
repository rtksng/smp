// @vitest-environment jsdom
import { cloneElement, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeScreen from "../app/(tabs)/index";
import { StoreHeader } from "./store-header";
import { cartFixture } from "../lib/testing/commerce-fixtures";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/search",
  params: {} as Record<string, string>,
  session: null as null | { customer: { id: string } },
  categories: vi.fn(), brands: vi.fn(), products: vi.fn(), cart: vi.fn()
}));

vi.mock("expo-router", () => ({
  router: { push: mocks.push },
  usePathname: () => mocks.pathname,
  useGlobalSearchParams: () => mocks.params,
  useLocalSearchParams: () => ({}),
  Link: ({ children, href }: PropsWithChildren<{ href: unknown }>) =>
    cloneElement(children as ReactElement<Record<string, unknown>>, {
      accessibilityRole: "link", onPress: () => mocks.push(href)
    })
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("expo-haptics", () => ({ selectionAsync: vi.fn() }));
vi.mock("expo-image", () => ({ Image: () => null }));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock("react-native-keyboard-controller", () => ({ KeyboardAwareScrollView: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ isReady: true, session: mocks.session }) }));
vi.mock("@/lib/api/catalog", () => ({ getCategories: mocks.categories, getBrands: mocks.brands, getProducts: mocks.products }));
vi.mock("@/lib/api/cart", () => ({ getCart: mocks.cart }));
vi.mock("@/components/product-card", () => ({ ProductCard: () => null }));

const clients: QueryClient[] = [];

function renderPage(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/search";
  mocks.params = {};
  mocks.session = null;
  mocks.categories.mockResolvedValue([{
    id: "furniture", slug: "furniture", name: "Furniture", isActive: true,
    parentId: null, children: [], sortOrder: 0, description: null,
    imageUrl: "https://media.example.com/furniture.png"
  }]);
  mocks.brands.mockResolvedValue([{
    id: "clinic-brand", slug: "clinic-brand", name: "Clinic Brand", isActive: true,
    description: null, logoUrl: null
  }]);
  mocks.products.mockResolvedValue({ items: [] });
  mocks.cart.mockResolvedValue(cartFixture());
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
});

describe("customer mobile home navigation", () => {
  it("opens each promotional banner's matching catalog or bulk destination", async () => {
    renderPage(<HomeScreen />);
    const destinations = [
      ["Hospital supplies ordered simply banner", "/search"],
      ["Diagnostics ready devices and monitors banner", { pathname: "/search", params: { category: "diagnostics" } }],
      ["Dental essentials clinic supplies banner", { pathname: "/search", params: { category: "dental" } }],
      ["Bulk orders procurement support banner", { pathname: "/", params: { section: "bulk" } }],
      ["Lab essentials reliable diagnostics banner", { pathname: "/search", params: { q: "diagnostics" } }]
    ] as const;

    for (const [label, destination] of destinations) {
      fireEvent.click(await screen.findByRole("link", { name: label }));
      expect(mocks.push).toHaveBeenLastCalledWith(destination);
    }
  });

  it("opens the selected category and its dedicated brand page", async () => {
    renderPage(<HomeScreen />);
    fireEvent.click(await screen.findByRole("link", { name: /Furniture Open catalog/ }));
    expect(mocks.push).toHaveBeenLastCalledWith({ pathname: "/search", params: { category: "furniture" } });
    fireEvent.click(await screen.findByRole("link", { name: /Clinic Brand/ }));
    expect(mocks.push).toHaveBeenLastCalledWith({ pathname: "/brands/[slug]", params: { slug: "clinic-brand" } });
    fireEvent.click(screen.getByRole("link", { name: "View all brands" }));
    expect(mocks.push).toHaveBeenLastCalledWith("/brands");
  });
});

describe("customer mobile shared header navigation", () => {
  it("retains the current product and query when an anonymous customer signs in", () => {
    mocks.pathname = "/products/sterile-kit";
    mocks.params = { slug: "sterile-kit", q: "clinic kit", category: "furniture" };
    renderPage(<StoreHeader />);

    fireEvent.click(screen.getByRole("link", { name: "Login or signup" }));
    expect(mocks.push).toHaveBeenLastCalledWith({
      pathname: "/login", params: { returnTo: expect.stringMatching(/^\/products\/sterile-kit\?/) }
    });
    const destination = new URL(mocks.push.mock.lastCall![0].params.returnTo, "https://customer.example.com");
    expect(destination.searchParams.get("q")).toBe("clinic kit");
    expect(destination.searchParams.get("category")).toBe("furniture");
    expect(destination.searchParams.has("slug")).toBe(false);
    fireEvent.click(screen.getByRole("link", { name: "Delivery at checkout" }));
    expect(mocks.push).toHaveBeenLastCalledWith("/search");
  });

  it("submits trimmed search text and keeps cart navigation available", () => {
    renderPage(<StoreHeader />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search products, SKU, or brand" }), {
      target: { value: "  sterile kit  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Search catalog" }));
    expect(mocks.push).toHaveBeenLastCalledWith({ pathname: "/search", params: { q: "sterile kit" } });
    fireEvent.click(screen.getByRole("link", { name: "Open cart" }));
    expect(mocks.push).toHaveBeenLastCalledWith("/cart");
  });

  it("opens the account directly for a signed-in customer", async () => {
    mocks.session = { customer: { id: "customer-1" } };
    renderPage(<StoreHeader />);
    fireEvent.click(screen.getByRole("link", { name: "Open account" }));
    expect(mocks.push).toHaveBeenLastCalledWith("/account");
    await waitFor(() => expect(mocks.cart).toHaveBeenCalled());
  });
});
