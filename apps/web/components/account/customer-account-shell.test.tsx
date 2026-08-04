import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountInfoGrid, CustomerAccountShell } from "./customer-account-shell";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace
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
          firstName: "Asha",
          mobileNumber: "+919800000001"
        }
      }
    })
}));

describe("CustomerAccountShell", () => {
  it("renders account metric cards in two columns on mobile", () => {
    render(
      <AccountInfoGrid
        items={[
          { label: "Total orders", value: "12" },
          { label: "Latest", value: "24 Jun 2026" },
          { label: "Latest status", value: "Created" },
          { label: "Latest total", value: "Rs 2,441.74" }
        ]}
      />
    );

    const metricGrid =
      screen.getByText("Total orders").parentElement?.parentElement;

    expect(metricGrid).toHaveClass("grid-cols-2", "xl:grid-cols-4");
  });

  it("renders compact route tabs with subpage breadcrumb and back navigation", () => {
    render(
      <CustomerAccountShell
        activePath="/account/profile"
        description="Manage account profile."
        title="Profile"
      >
        <div>Profile content</div>
      </CustomerAccountShell>
    );

    expect(
      screen.queryByRole("link", { name: "Overview" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/account/profile"
    );
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/account/orders"
    );
    expect(screen.getByRole("link", { name: "Wishlist" })).toHaveAttribute(
      "href",
      "/account/wishlist"
    );
    expect(screen.getByRole("link", { name: "Addresses" })).toHaveAttribute(
      "href",
      "/account/addresses"
    );
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.getByTestId("desktop-account-sidebar")).toHaveClass(
      "hidden",
      "lg:grid"
    );
    expect(screen.queryByTestId("mobile-account-menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("account-content")).toHaveClass("grid");

    const activeTab = screen.getByRole("link", { name: "Profile" });
    expect(activeTab).toHaveAttribute("href", "/account/profile");
    expect(activeTab).toHaveAttribute("aria-current", "page");
    expect(activeTab).toHaveClass("min-h-9", "px-3", "text-xs");
    expect(activeTab.querySelector("svg")).toHaveClass("h-3.5", "w-3.5");

    const breadcrumb = screen.getByLabelText("Breadcrumb");
    expect(
      within(breadcrumb).getByRole("link", { name: "Account" })
    ).toHaveAttribute("href", "/account");
    expect(within(breadcrumb).getByText("Profile")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Back to account" })
    ).toHaveAttribute("href", "/account");
  });

  it("uses the account landing as the mobile vertical menu", () => {
    render(
      <CustomerAccountShell
        activePath="/account"
        description=""
        title="Account"
      >
        <div>Profile content</div>
      </CustomerAccountShell>
    );

    const mobileMenu = screen.getByTestId("mobile-account-menu");
    expect(mobileMenu).toHaveClass("grid", "lg:hidden");
    expect(
      within(mobileMenu).queryByRole("link", { name: /Overview/ })
    ).not.toBeInTheDocument();
    expect(
      within(mobileMenu).getByRole("link", { name: /Profile/ })
    ).toHaveAttribute("href", "/account/profile");
    expect(
      within(mobileMenu).getByRole("link", { name: /Orders/ })
    ).toHaveAttribute("href", "/account/orders");
    expect(
      within(mobileMenu).getByRole("link", { name: /Wishlist/ })
    ).toHaveAttribute("href", "/account/wishlist");
    expect(
      within(mobileMenu).getByRole("link", { name: /Addresses/ })
    ).toHaveAttribute("href", "/account/addresses");
    expect(
      within(mobileMenu).getByRole("link", { name: /Quotes/ })
    ).toHaveAttribute("href", "/account/quotes");
    expect(
      within(mobileMenu).getByRole("button", { name: "Logout" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("account-content")).toHaveClass(
      "hidden",
      "lg:grid"
    );
    expect(screen.getByText("Profile content")).toBeInTheDocument();
  });

  it("removes visual shadows from account pages and nested account surfaces", () => {
    render(
      <CustomerAccountShell
        activePath="/account/orders"
        description="Review order history."
        title="Orders"
      >
        <div>Orders content</div>
      </CustomerAccountShell>
    );

    expect(screen.getByTestId("account-main")).toHaveClass("accountNoShadows");
  });
});
