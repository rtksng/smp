import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "./admin-shell";

const mocks = vi.hoisted(() => ({ pathname: "/dashboard", permissions: [] as string[] }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      href={typeof href === "string" ? href : String(href)}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  )
}));
vi.mock("@/components/admin/admin-topbar", () => ({
  AdminMobileAccount: () => <footer>Mobile admin account</footer>,
  AdminTopbar: ({
    isMobileNavigationOpen,
    mobileNavigationTriggerRef,
    onOpenMobileNavigation
  }: {
    isMobileNavigationOpen: boolean;
    mobileNavigationTriggerRef: Ref<HTMLButtonElement>;
    onOpenMobileNavigation: () => void;
  }) => (
    <header>
      Admin toolbar
      <button
        aria-expanded={isMobileNavigationOpen}
        aria-label="Open navigation"
        onClick={onOpenMobileNavigation}
        ref={mobileNavigationTriggerRef}
        type="button"
      />
    </header>
  )
}));
vi.mock("../lib/admin-session", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
  useAdminSession: () => ({ admin: { permissions: mocks.permissions } })
}));

describe("AdminShell navigation", () => {
  beforeEach(() => {
    mocks.pathname = "/dashboard";
    mocks.permissions = [];
    window.localStorage.clear();
    document.body.style.overflow = "";
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("opens and closes the mobile navigation without relying on a modal portal", () => {
    const { container } = render(
      <AdminShell>
        <p>Dashboard content</p>
      </AdminShell>
    );
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    const overlay = container.querySelector(".mobileNavOverlay");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).not.toHaveClass("mobileNavOverlay--open");
    expect(
      screen.queryByRole("dialog", { name: "Admin navigation menu" })
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const drawer = screen.getByRole("dialog", { name: "Admin navigation menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(overlay).toHaveAttribute("aria-hidden", "false");
    expect(overlay).toHaveClass("mobileNavOverlay--open");
    expect(
      within(drawer).getByRole("button", { name: "Close navigation" })
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(drawer).getByText("Mobile admin account")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Admin navigation menu" })
    ).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).not.toHaveClass("mobileNavOverlay--open");
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("collapses, expands, and remembers the desktop sidebar preference", async () => {
    window.localStorage.setItem("surgical.admin.sidebarCollapsed", "true");
    const { container } = render(
      <AdminShell>
        <p>Dashboard content</p>
      </AdminShell>
    );

    await waitFor(() =>
      expect(container.querySelector(".shell")).toHaveClass("sidebarCollapsed")
    );

    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "title",
      "Dashboard"
    );

    fireEvent.click(expand);

    expect(container.querySelector(".shell")).not.toHaveClass("sidebarCollapsed");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(window.localStorage.getItem("surgical.admin.sidebarCollapsed")).toBe(
      "false"
    );
  });

  it("lists delivery pages in a dropdown that highlights only the current page", () => {
    mocks.pathname = "/delivery/requests";
    mocks.permissions = ["delivery.read"];
    render(
      <AdminShell>
        <p>Delivery content</p>
      </AdminShell>
    );
    const sidebar = within(document.getElementById("admin-sidebar")!);
    const toggle = sidebar.getByRole("button", { name: "Delivery" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const menu = within(document.getElementById(toggle.getAttribute("aria-controls")!)!);
    expect(
      menu.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["All Delivery Partners", "/delivery/partners"],
      ["All Requests", "/delivery/requests"],
      ["All Assignments", "/delivery/assignments"],
      ["Analytics", "/delivery"]
    ]);
    expect(menu.getByRole("link", { name: "All Requests" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(menu.getByRole("link", { name: "Analytics" })).not.toHaveAttribute(
      "aria-current"
    );

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar.queryByRole("link", { name: "All Requests" })).not.toBeInTheDocument();
  });

  it("opens the delivery dropdown from another section without leaving the page", () => {
    mocks.permissions = ["delivery.read"];
    render(
      <AdminShell>
        <p>Dashboard content</p>
      </AdminShell>
    );
    const sidebar = within(document.getElementById("admin-sidebar")!);
    const toggle = sidebar.getByRole("button", { name: "Delivery" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/delivery"
    );
    expect(sidebar.getByRole("link", { name: "Analytics" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
