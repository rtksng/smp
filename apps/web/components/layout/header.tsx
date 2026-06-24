"use client";

import { APP_NAMES } from "@surgical/config";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ChevronDown,
  Grid2X2,
  LogOut,
  MapPin,
  Menu,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCart } from "../../lib/api/cart";
import { getCategories } from "../../lib/api/categories";
import { createLogoutMutation } from "../../lib/api/mutation-helpers";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { buildCategoryNavigation } from "../../lib/catalog/customer-navigation";
import { getCurrentCustomerPath } from "../../lib/auth/current-path";
import {
  mobileDrawerOverlayClassName,
  mobileDrawerPanelClassName
} from "../../lib/responsive/responsive-classes";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { useCartStore } from "../../lib/stores/cart-store";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { SearchForm } from "../home/search-form";
import { MobileBottomNavigation } from "./mobile-bottom-navigation";

const mobileNavItems = [
  { href: "/products", label: "Products" },
  { href: "/#categories", label: "Departments" },
  { href: "/brands", label: "Brands" },
  { href: "/#bulk", label: "Bulk quote" }
] as const;
const fixedHeaderOffsetClassName = "h-[6.5rem]";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeLogin = useCustomerAuthStore((state) => state.closeLogin);
  const logout = useCustomerAuthStore((state) => state.logout);
  const promptLogin = useCustomerAuthStore((state) => state.promptLogin);
  const session = useCustomerAuthStore((state) => state.session);
  const itemCount = useCartStore((state) => state.totalQuantity);
  const resetCartSummary = useCartStore((state) => state.reset);
  const setCartSummary = useCartStore((state) => state.setSummary);
  const categoriesQuery = useQuery({
    queryFn: getCategories,
    queryKey: ["customer-header-categories"],
    staleTime: 60_000
  });
  const categoryNavigation = useMemo(
    () => buildCategoryNavigation(categoriesQuery.data, 10),
    [categoriesQuery.data]
  );
  const cartQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => getCart(),
    queryKey: customerQueryKeys.cart()
  });
  const logoutMutation = useMutation(
    createLogoutMutation({
      logout,
      onSettled: () => {
        resetCartSummary();
        setMenuOpen(false);
        closeLogin();
      }
    })
  );

  useEffect(() => {
    if (cartQuery.data) {
      setCartSummary(cartQuery.data);
    }
  }, [cartQuery.data, setCartSummary]);

  useEffect(() => {
    if (!session) {
      resetCartSummary();
    }
  }, [resetCartSummary, session]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  async function handleLogout() {
    await logoutMutation.mutateAsync().catch(() => undefined);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#cfe9d2] bg-white/92 backdrop-blur">
      <div className="grid w-full max-w-full gap-3 overflow-hidden px-4 py-2 lg:hidden">
        <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden">
          <Link className="flex min-w-0 items-center gap-2" href="/">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#287c30] text-white shadow-sm shadow-[#287c30]/20">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-black uppercase tracking-[0.02em] text-[#173b1d]">
              {APP_NAMES.customerWeb}
            </span>
          </Link>
          <Link
            className="inline-flex min-h-8 max-w-[9.5rem] items-center gap-1 rounded-full bg-[#f4fbf5] px-3 text-[10px] font-semibold text-[#173b1d]"
            href="/products"
          >
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#287c30]" />
            <span className="truncate">Delivery at checkout</span>
          </Link>
        </div>

        <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_2.25rem_2.25rem] items-center gap-2 overflow-hidden">
          <form
            action="/products"
            className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded-full border border-[#287c30] bg-white px-4 shadow-sm shadow-[#287c30]/5"
          >
            <input
              aria-label="Search products, SKU, or brand"
              className="min-w-0 bg-transparent text-sm font-semibold text-[#173b1d] outline-none placeholder:text-[#556b57]"
              name="q"
              placeholder="Search products or SKU"
              type="search"
            />
            <button
              aria-label="Search catalog"
              className="grid h-8 w-8 place-items-center text-[#173b1d]"
              type="submit"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>
          <button
            aria-label={session ? "Open account" : "Login or signup"}
            className="grid h-10 w-8 place-items-center text-[#111827]"
            onClick={() => {
              if (!session) {
                promptLogin(getCurrentCustomerPath());
              }
            }}
            type="button"
          >
            <UserRound aria-hidden="true" className="h-5 w-5" />
          </button>
          <Link
            aria-label="Open cart"
            className="relative grid h-10 w-8 place-items-center text-[#111827]"
            href="/cart"
          >
            <ShoppingCart aria-hidden="true" className="h-5 w-5" />
            {itemCount > 0 ? (
              <span className="absolute right-0 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#287c30] px-1 text-[9px] font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <Container className="hidden lg:block">
        <div className="grid min-h-20 grid-cols-[1fr_auto] items-center gap-3 py-3 lg:grid-cols-[auto_auto_minmax(320px,1fr)_auto] lg:gap-4">
          <Link className="flex min-w-0 items-center gap-3 xl:min-w-64" href="/">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#287c30] text-white shadow-sm shadow-[#287c30]/20">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[#173b1d] sm:text-base">
                {APP_NAMES.customerWeb}
              </span>
            </span>
          </Link>

          <CategoryMenu categoryNavigation={categoryNavigation} />

          <div className="hidden min-w-0 lg:block">
            <SearchForm compact id="header-search" placeholder="Search catalog" />
          </div>

          <div className="hidden items-center justify-end gap-2 sm:flex">
            <Button aria-label="Open cart" href="/cart" variant="outline">
              <ShoppingCart aria-hidden="true" className="h-4 w-4" />
              Cart
              <span className="rounded-full bg-[#eaf7eb] px-2 py-0.5 text-xs text-[#287c30]">
                {itemCount}
              </span>
            </Button>
            {session ? (
              <>
                <Button href="/account" variant="secondary">
                  <UserRound aria-hidden="true" className="h-4 w-4" />
                  Account
                </Button>
                <Button
                  aria-label="Logout"
                  disabled={logoutMutation.isPending}
                  onClick={handleLogout}
                  variant="ghost"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={() => promptLogin(getCurrentCustomerPath())}
                variant="secondary"
              >
                <UserRound aria-hidden="true" className="h-4 w-4" />
                Login / Signup
              </Button>
            )}
          </div>

          <button
            aria-expanded={menuOpen}
            aria-label="Toggle mobile navigation"
            className="ml-auto grid h-11 w-11 place-items-center rounded-full border border-[#cfe9d2] bg-white text-[#173b1d] shadow-sm shadow-[#287c30]/5 lg:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
          >
            {menuOpen ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </Container>

      {menuOpen ? (
        <div className={mobileDrawerOverlayClassName}>
          <button
            aria-label="Close mobile navigation"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setMenuOpen(false)}
            type="button"
          />
          <aside
            aria-label="Mobile navigation"
            aria-modal="true"
            className={mobileDrawerPanelClassName}
            role="dialog"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#cfe9d2] pb-4">
              <Link
                className="flex min-w-0 items-center gap-3"
                href="/"
                onClick={() => setMenuOpen(false)}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#287c30] text-white">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#173b1d]">
                    {APP_NAMES.customerWeb}
                  </span>
                </span>
              </Link>
              <button
                aria-label="Close menu"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#cfe9d2] bg-white text-[#173b1d]"
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <SearchForm
                compact
                id="mobile-header-search"
                placeholder="Search products or SKU"
              />
            </div>

            <nav
              className="mt-5 grid gap-2 text-sm font-semibold text-[#173b1d]"
              aria-label="Mobile navigation links"
            >
              {mobileNavItems.map((item) => (
                <Link
                  className={mobileNavLinkClassName}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                className={mobileNavLinkClassName}
                href="/cart"
                onClick={() => setMenuOpen(false)}
              >
                <span>Cart</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#287c30]">
                  {itemCount}
                </span>
              </Link>
            </nav>

            <div className="mt-5 grid gap-2 border-t border-[#cfe9d2] pt-4 text-sm font-semibold">
              {session ? (
                <>
                  <Link
                    className={mobileNavLinkClassName}
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                  >
                    Account
                  </Link>
                  <button
                    className={`${mobileNavLinkClassName} text-left`}
                    disabled={logoutMutation.isPending}
                    onClick={handleLogout}
                    type="button"
                  >
                    {logoutMutation.isPending ? "Logging out..." : "Logout"}
                  </button>
                </>
              ) : (
                <button
                  className={`${mobileNavLinkClassName} text-left`}
                  onClick={() => {
                    setMenuOpen(false);
                    promptLogin(getCurrentCustomerPath());
                  }}
                  type="button"
                >
                  Login / Signup
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : null}
      </header>
      <div
        aria-hidden="true"
        className={fixedHeaderOffsetClassName}
        data-testid="header-fixed-spacer"
      />
      <MobileBottomNavigation categories={categoryNavigation} />
    </>
  );
}

function CategoryMenu({
  categoryNavigation
}: {
  categoryNavigation: ReturnType<typeof buildCategoryNavigation>;
}) {
  return (
    <details className="group relative hidden lg:block">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-full border border-[#cfe9d2] bg-[#f4fbf5] px-4 text-sm font-semibold text-[#287c30] transition duration-200 hover:border-[#287c30] hover:bg-[#eaf7eb]">
        <Grid2X2 aria-hidden="true" className="h-4 w-4" />
        Categories
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 transition group-open:rotate-180"
        />
      </summary>
      <div className="absolute left-0 top-14 z-50 w-[min(78vw,900px)] overflow-hidden rounded-[1.25rem] border border-[#cfe9d2] bg-white shadow-2xl shadow-[#287c30]/10">
        <div className="grid max-h-[72vh] overflow-y-auto lg:grid-cols-[240px_1fr]">
          <div className="border-r border-[#cfe9d2] bg-[#f4fbf5] p-3">
            <p className="mb-2 px-2 text-xs font-semibold uppercase text-[#287c30]">
              Departments
            </p>
            <div className="grid gap-1">
              {categoryNavigation.slice(0, 10).map((category) => (
                <Link
                  className="rounded-full px-3 py-2 text-sm font-semibold text-[#173b1d] hover:bg-white hover:text-[#287c30]"
                  href={category.href}
                  key={category.id}
                >
                  {category.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-4 p-4">
            {categoryNavigation.length === 0 ? (
              <div className="flex min-h-36 items-center justify-center rounded-[1rem] border border-dashed border-[#cfe9d2] bg-[#f4fbf5] p-5 text-center">
                <div>
                  <PackageSearch
                    aria-hidden="true"
                    className="mx-auto h-8 w-8 text-[#287c30]"
                  />
                  <p className="mt-3 text-sm font-semibold text-[#173b1d]">
                    Category navigation loads from the catalog API.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {categoryNavigation.slice(0, 6).map((category) => (
                  <section
                    className="rounded-[1rem] border border-[#cfe9d2] bg-white p-4 shadow-sm shadow-[#287c30]/5"
                    key={category.id}
                  >
                    <Link
                      className="font-semibold text-[#173b1d] hover:text-[#287c30]"
                      href={category.href}
                    >
                      {category.label}
                    </Link>
                    {category.children.length > 0 ? (
                      <div className="mt-3 grid gap-1">
                        {category.children.slice(0, 3).map((subcategory) => (
                          <Link
                            className="rounded-full px-2 py-1.5 text-xs font-semibold text-[#556b57] hover:bg-[#eaf7eb] hover:text-[#287c30]"
                            href={subcategory.href}
                            key={subcategory.id}
                          >
                            {subcategory.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

const mobileNavLinkClassName =
  "flex min-h-12 items-center justify-between gap-3 rounded-full bg-[#f4fbf5] px-4 py-3 transition hover:bg-[#eaf7eb]";
