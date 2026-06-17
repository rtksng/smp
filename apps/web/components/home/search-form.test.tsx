import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./search-form";

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  routerPush: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush
  })
}));

vi.mock("../../lib/api/products", () => ({
  getProducts: mocks.getProducts
}));

describe("SearchForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.getProducts.mockReset();
    mocks.getProducts.mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 5,
        page: 1,
        total: 0,
        totalPages: 0
      }
    });
    mocks.routerPush.mockReset();
  });

  it("renders procurement shortcut links when suggestions are provided", () => {
    renderSearchForm(
      <SearchForm
        id="search"
        suggestions={["Sutures", "Pulse oximeter", "Sterile gloves"]}
      />
    );

    expect(screen.getByRole("link", { name: "Sutures" })).toHaveAttribute(
      "href",
      "/products?q=Sutures"
    );
    expect(screen.getByRole("link", { name: "Pulse oximeter" })).toHaveAttribute(
      "href",
      "/products?q=Pulse+oximeter"
    );
  });

  it("stores submitted searches as recent suggestions", async () => {
    renderSearchForm(<SearchForm id="search" />);

    fireEvent.change(screen.getByLabelText("Search products, SKU, or brand"), {
      target: { value: "forceps" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(mocks.routerPush).toHaveBeenCalledWith("/products?q=forceps");
    expect(
      JSON.parse(window.localStorage.getItem("surgical.customer.recent-searches") ?? "[]")
    ).toEqual(["forceps"]);
  });
});

function renderSearchForm(ui: ReactElement) {
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
