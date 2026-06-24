import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCatalogStore } from "../../lib/stores/catalog-store";
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
    useCatalogStore.setState({
      searchInput: "",
      submittedSearch: ""
    });
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

  it("shows procurement shortcut links after the search input is focused", () => {
    renderSearchForm(
      <SearchForm
        id="search"
        suggestions={["Sutures", "Pulse oximeter", "Sterile gloves"]}
      />
    );

    expect(screen.queryByRole("link", { name: "Sutures" })).not.toBeInTheDocument();

    fireEvent.focus(screen.getByLabelText("Search products, SKU, or brand"));

    expect(screen.getByRole("link", { name: "Sutures" })).toHaveAttribute(
      "href",
      "/products?q=Sutures"
    );
    expect(screen.getByRole("link", { name: "Pulse oximeter" })).toHaveAttribute(
      "href",
      "/products?q=Pulse+oximeter"
    );
  });

  it("starts empty even when a previous search is stored in catalog state", () => {
    useCatalogStore.setState({
      searchInput: "cat",
      submittedSearch: "cat"
    });

    renderSearchForm(<SearchForm id="search" />);

    expect(screen.getByLabelText("Search products, SKU, or brand")).toHaveValue("");
  });

  it("shows recent searches on focus before the user types", () => {
    window.localStorage.setItem(
      "surgical.customer.recent-searches",
      JSON.stringify(["cat", "forceps"])
    );

    renderSearchForm(<SearchForm id="search" />);

    fireEvent.focus(screen.getByLabelText("Search products, SKU, or brand"));

    expect(screen.getByRole("link", { name: "cat" })).toHaveAttribute(
      "href",
      "/products?q=cat"
    );
    expect(screen.getByRole("link", { name: "forceps" })).toHaveAttribute(
      "href",
      "/products?q=forceps"
    );
  });

  it("replaces recent searches with product suggestions after typing", async () => {
    window.localStorage.setItem(
      "surgical.customer.recent-searches",
      JSON.stringify(["cat"])
    );
    mocks.getProducts.mockResolvedValue({
      items: [{ name: "Sterile Gloves", sku: "GLV-100" }],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 5,
        page: 1,
        total: 1,
        totalPages: 1
      }
    });

    renderSearchForm(<SearchForm id="search" />);

    const input = screen.getByLabelText("Search products, SKU, or brand");

    fireEvent.focus(input);
    expect(screen.getByRole("link", { name: "cat" })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "glov" } });

    expect(screen.queryByRole("link", { name: "cat" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Sterile Gloves" })).toBeInTheDocument()
    );
    expect(screen.getByRole("link", { name: "GLV-100" })).toBeInTheDocument();
  });

  it("renders compact suggestions in an overlay so the header row stays stable", () => {
    window.localStorage.setItem(
      "surgical.customer.recent-searches",
      JSON.stringify(["cat"])
    );

    renderSearchForm(<SearchForm compact id="search" />);

    fireEvent.focus(screen.getByLabelText("Search products, SKU, or brand"));

    expect(screen.getByTestId("search-suggestions")).toHaveClass("absolute");
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
