"use client";

import { APP_NAMES } from "@surgical/config";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Grid2X2,
  LogOut,
  Menu,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { getCart } from "../../lib/api/cart";
import { createLogoutMutation } from "../../lib/api/mutation-helpers";
import { customerQueryKeys } from "../../lib/api/query-keys";
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

const categoryLinks = [
  "Surgical instruments",
  "Critical care",
  "Diagnostics",
  "Consumables"
] as const;

const headerTrustItems = [
  "GST-ready invoices",
  "Bulk quote support",
  "Customer-safe catalog"
] as const;

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeLogin = useCustomerAuthStore((state) => state.closeLogin);
  const logout = useCustomerAuthStore((state) => state.logout);
  const promptLogin = useCustomerAuthStore((state) => state.promptLogin);
  const session = useCustomerAuthStore((state) => state.session);
  const itemCount = useCartStore((state) => state.totalQuantity);
  const resetCartSummary = useCartStore((state) => state.reset);
  const setCartSummary = useCartStore((state) => state.setSummary);
  const cartQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getCart,
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
    <header className="sticky top-0 z-40 border-b border-[#d8e2df] bg-white/95 backdrop-blur">
      <div className="hidden border-b border-white/10 bg-[#17211f] text-white lg:block">
        <Container>
          <div className="flex min-h-9 items-center justify-between gap-4 text-xs font-bold">
            <span className="text-white/80">Hospital and clinic procurement desk</span>
            <div className="flex items-center gap-5 text-white/75">
              {headerTrustItems.map((item) => (
                <span className="inline-flex items-center gap-2" key={item}>
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-[#8bd7d1]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </Container>
      </div>
      <Container>
        <div className="flex min-h-20 items-center gap-4 py-3">
          <Link className="flex min-w-0 items-center gap-3 xl:min-w-64" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#006d77] text-white">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-[#17211f]">
                {APP_NAMES.customerWeb}
              </span>
              <span className="block text-xs font-bold text-[#687773]">
                Medical procurement
              </span>
            </span>
          </Link>

          <div className="hidden flex-1 lg:block">
            <SearchForm
              compact
              id="header-search"
              placeholder="Search catalog"
            />
          </div>

          <nav className="ml-auto hidden items-center gap-2 lg:flex" aria-label="Primary navigation">
            <Link className="rounded-lg px-3 py-3 text-sm font-extrabold text-[#31413d] hover:bg-[#eef3f1]" href="/products">
              Products
            </Link>
            <details className="group relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-extrabold text-[#31413d] hover:bg-[#eef3f1]">
                <Grid2X2 aria-hidden="true" className="h-4 w-4" />
                Categories
              </summary>
              <div className="absolute right-0 top-12 grid w-60 gap-1 rounded-lg border border-[#d8e2df] bg-white p-2 shadow-xl">
                {categoryLinks.map((item) => (
                  <Link
                    className="rounded-md px-3 py-2 text-sm font-bold text-[#31413d] hover:bg-[#eef3f1]"
                    href="/#categories"
                    key={item}
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </details>
            <Link className="rounded-lg px-3 py-3 text-sm font-extrabold text-[#31413d] hover:bg-[#eef3f1]" href="/#brands">
              Brands
            </Link>
            <Link className="rounded-lg px-3 py-3 text-sm font-extrabold text-[#31413d] hover:bg-[#eef3f1]" href="/#bulk">
              Bulk quotes
            </Link>
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Button aria-label="Open cart" href="/cart" variant="outline">
              <ShoppingCart aria-hidden="true" className="h-4 w-4" />
              Cart
              <span className="rounded-full bg-[#e7f3f2] px-2 py-0.5 text-xs text-[#006d77]">
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
            className="ml-auto grid h-11 w-11 place-items-center rounded-lg border border-[#d8e2df] bg-white text-[#17211f] lg:hidden"
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
            <div className="flex items-center justify-between gap-3 border-b border-[#d8e2df] pb-4">
              <Link
                className="flex min-w-0 items-center gap-3"
                href="/"
                onClick={() => setMenuOpen(false)}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#006d77] text-white">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-[#17211f]">
                    {APP_NAMES.customerWeb}
                  </span>
                  <span className="block text-xs font-bold text-[#687773]">
                    Medical procurement
                  </span>
                </span>
              </Link>
              <button
                aria-label="Close menu"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#d8e2df] bg-white text-[#17211f]"
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <SearchForm compact id="mobile-header-search" />
            </div>

            <nav
              className="mt-5 grid gap-2 text-sm font-extrabold text-[#31413d]"
              aria-label="Mobile navigation links"
            >
              <Link className={mobileNavLinkClassName} href="/#categories" onClick={() => setMenuOpen(false)}>
                Categories
              </Link>
              <Link className={mobileNavLinkClassName} href="/products" onClick={() => setMenuOpen(false)}>
                Products
              </Link>
              <Link className={mobileNavLinkClassName} href="/#brands" onClick={() => setMenuOpen(false)}>
                Brands
              </Link>
              <Link className={mobileNavLinkClassName} href="/#bulk" onClick={() => setMenuOpen(false)}>
                Bulk quotes
              </Link>
              <Link className={mobileNavLinkClassName} href="/cart" onClick={() => setMenuOpen(false)}>
                <span>Cart</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#006d77]">
                  {itemCount}
                </span>
              </Link>
              {session ? (
                <>
                  <Link className={mobileNavLinkClassName} href="/account" onClick={() => setMenuOpen(false)}>
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
            </nav>
          </aside>
        </div>
      ) : null}
    </header>
  );
}

const mobileNavLinkClassName =
  "flex min-h-12 items-center justify-between gap-3 rounded-lg bg-[#eef3f1] px-3 py-3 transition hover:bg-[#e7f3f2]";
