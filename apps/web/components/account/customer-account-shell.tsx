"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  FileText,
  LogOut,
  Heart,
  MapPin,
  Package,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { ProtectedCustomerRoute } from "../auth/protected-customer-route";

const accountLinks = [
  { href: "/account/profile", icon: UserRound, label: "Profile" },
  { href: "/account/orders", icon: Package, label: "Orders" },
  { href: "/account/wishlist", icon: Heart, label: "Wishlist" },
  { href: "/account/addresses", icon: MapPin, label: "Addresses" },
  { href: "/account/quotes", icon: FileText, label: "Quotes" }
];

type CustomerAccountShellProps = {
  activePath?: string;
  children: ReactNode;
  description: string;
  title: string;
};

export function CustomerAccountShell({
  activePath,
  children,
  description,
  title
}: CustomerAccountShellProps) {
  const router = useRouter();
  const logout = useCustomerAuthStore((state) => state.logout);
  const session = useCustomerAuthStore((state) => state.session);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const activeLink =
    accountLinks.find((link) => link.href === activePath) ?? {
      href: "/account/profile",
      icon: UserRound,
      label: "Profile"
    };
  const showBreadcrumb = activePath !== "/account";
  const isAccountLanding = activePath === "/account";

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <Header />
      <main
        className="accountNoShadows bg-[#f3faf9]"
        data-testid="account-main"
      >
        <Container className="py-6 sm:py-8">
          <ProtectedCustomerRoute>
            <div className="grid gap-5 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-6">
              <aside
                className="hidden gap-3 self-start rounded-lg border border-[#c4e4e0] bg-white p-3 shadow-sm shadow-[#0f6f68]/5 sm:p-4 lg:sticky lg:top-24 lg:grid"
                data-testid="desktop-account-sidebar"
              >
                <div>
                  <p className="text-xs font-semibold uppercase text-[#0f6f68]">
                    Customer account
                  </p>
                  <p className="mt-2 text-base font-semibold text-[#123f3c]">
                    {session?.customer.firstName ?? "Customer"}
                  </p>
                  <p className="mt-1 break-words text-xs font-semibold text-[#55716e]">
                    {session?.customer.mobileNumber}
                  </p>
                </div>
                <nav
                  aria-label="Account navigation"
                  className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-1"
                >
                  {accountLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = activePath === link.href;

                    return (
                      <Link
                        className={accountLinkClass(link.href, activePath)}
                        href={link.href}
                        key={link.href}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
                <Button
                  className="w-full"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                  variant="outline"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Button>
              </aside>

              {isAccountLanding ? (
                <section
                  aria-label="Account menu"
                  className="grid gap-2 rounded-lg border border-[#c4e4e0] bg-white p-3 lg:hidden"
                  data-testid="mobile-account-menu"
                >
                  {accountLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = activePath === link.href;

                    return (
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={mobileAccountLinkClass(link.href, activePath)}
                        href={link.href}
                        key={link.href}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                          />
                          {link.label}
                        </span>
                        <span aria-hidden="true" className="text-[#728b87]">
                          ›
                        </span>
                      </Link>
                    );
                  })}
                  <Button
                    className="mt-1 w-full justify-start"
                    disabled={isLoggingOut}
                    onClick={handleLogout}
                    variant="outline"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </Button>
                </section>
              ) : null}

              <section
                className={[
                  "min-w-0 gap-5",
                  isAccountLanding ? "hidden lg:grid" : "grid"
                ].join(" ")}
                data-testid="account-content"
              >
                <div className="border-b border-[#c4e4e0] pb-4">
                  {showBreadcrumb ? (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-xs font-semibold text-[#55716e]"
                      >
                        <Link
                          className="text-[#0f6f68] transition hover:text-[#0b5e59]"
                          href="/account"
                        >
                          Account
                        </Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page" className="text-[#123f3c]">
                          {activeLink.label}
                        </span>
                      </nav>
                      <Link
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#c4e4e0] bg-white px-3 text-xs font-semibold text-[#123f3c] transition hover:border-[#0f6f68] hover:text-[#0f6f68]"
                        href="/account"
                      >
                        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                        Back to account
                      </Link>
                    </div>
                  ) : null}
                  <h1 className="text-2xl font-semibold leading-tight text-[#123f3c] sm:text-3xl">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#55716e]">
                    {description}
                  </p>
                </div>
                {children}
              </section>
            </div>
          </ProtectedCustomerRoute>
        </Container>
      </main>
      <Footer />
    </>
  );
}

export function CustomerAccountLanding({ children }: { children?: ReactNode }) {
  return (
    <CustomerAccountShell activePath="/account" description="" title="Account">
      {children}
    </CustomerAccountShell>
  );
}

export function AccountInfoGrid({
  items
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="rounded-lg border border-[#c4e4e0] bg-white p-4 shadow-sm shadow-[#0f6f68]/5"
          key={item.label}
        >
          <p className="text-xs font-semibold uppercase text-[#55716e]">
            {item.label}
          </p>
          <p className="mt-2 break-words text-sm font-semibold text-[#123f3c]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function PrivateEmptyState({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#c4e4e0] bg-white p-6 text-center shadow-sm shadow-[#0f6f68]/5">
      <h2 className="text-base font-semibold text-[#123f3c]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#55716e]">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AccountSection({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

export function AccountSectionHeader({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold leading-snug text-[#123f3c]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm font-semibold leading-5 text-[#55716e]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AccountStatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success";
}) {
  return (
    <span
      className={[
        "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold",
        tone === "success"
          ? "bg-[#e5f5f3] text-[#0f6f68]"
          : "bg-[#e5f5f3] text-[#123f3c]"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function accountLinkClass(href: string, activePath: string | undefined) {
  const isActive = activePath === href;

  return [
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-center text-xs font-semibold transition lg:justify-start lg:text-left",
    isActive
      ? "border-[#0f6f68] bg-[#0f6f68] text-white shadow-sm shadow-[#0f6f68]/20"
      : "border-[#c4e4e0] bg-[#f3faf9] text-[#123f3c] hover:border-[#0f6f68] hover:bg-[#e5f5f3] hover:text-[#0f6f68]"
  ].join(" ");
}

function mobileAccountLinkClass(href: string, activePath: string | undefined) {
  const isActive = activePath === href;

  return [
    "flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 text-sm font-semibold transition",
    isActive
      ? "border-[#0f6f68] bg-[#e5f5f3] text-[#123f3c]"
      : "border-[#c4e4e0] bg-[#f7fcfb] text-[#123f3c] hover:border-[#0f6f68] hover:bg-[#e5f5f3] hover:text-[#0f6f68]"
  ].join(" ");
}
