import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryNavigationItem } from "../../lib/catalog/customer-navigation";
import { MobileBottomNavigation } from "./mobile-bottom-navigation";

const usePathnameMock = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock()
}));

const categories: CategoryNavigationItem[] = [
  category("consumables", "Consumables"),
  category("diagnostics", "Diagnostics")
];

describe("MobileBottomNavigation", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue("/");
  });

  it("opens the shared category browser from the mobile Categories tab", () => {
    render(<MobileBottomNavigation categories={categories} />);

    const categoriesAction = screen.getByRole("link", { name: "Open categories" });

    expect(
      screen.getByRole("navigation", { name: "Mobile bottom navigation" })
    ).toHaveClass("py-1.5");
    expect(categoriesAction).toHaveAttribute("href", "/#categories");
    expect(categoriesAction).toHaveClass("min-h-14", "text-[10px]");

    fireEvent.click(categoriesAction);

    const dialog = screen.getByRole("dialog", { name: "Browse categories" });

    expect(within(dialog).getByRole("link", { name: /Diagnostics/i })).toHaveAttribute(
      "href",
      "/categories/diagnostics"
    );
  });

  it("opens the shared search sheet full screen from the mobile Search tab", () => {
    render(<MobileBottomNavigation categories={categories} />);

    const searchAction = screen.getByRole("link", { name: "Open search" });

    expect(searchAction).toHaveAttribute("href", "/products");

    fireEvent.click(searchAction);

    const dialog = screen.getByRole("dialog", { name: "Search catalog" });

    expect(dialog).toHaveClass("inset-0", "h-dvh", "w-dvw", "rounded-none");
    expect(screen.getByPlaceholderText("Search catalog")).toHaveAttribute("name", "q");
    expect(within(dialog).getByRole("link", { name: "Consumables" })).toHaveAttribute(
      "href",
      "/categories/consumables"
    );
  });

  it("hides on product detail routes so sticky purchase actions have the bottom edge", () => {
    usePathnameMock.mockReturnValue("/products/surgipro-artery-forceps");

    render(<MobileBottomNavigation categories={categories} />);

    expect(
      screen.queryByRole("navigation", { name: "Mobile bottom navigation" })
    ).not.toBeInTheDocument();
  });
});

function category(slug: string, label: string): CategoryNavigationItem {
  return {
    children: [],
    description: null,
    href: `/categories/${slug}`,
    id: slug,
    imageUrl: null,
    label,
    slug
  };
}
