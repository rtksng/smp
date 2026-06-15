"use client";

import type { ReactNode } from "react";
import {
  LayoutDashboard,
  LogOut,
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
  { href: "/account", icon: LayoutDashboard, label: "Overview" },
  { href: "/account/profile", icon: UserRound, label: "Profile" },
  { href: "/account/addresses", icon: MapPin, label: "Addresses" },
  { href: "/account/orders", icon: Package, label: "Orders" }
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
      <main className="bg-[#f4f9ff]">
        <Container className="py-6 sm:py-8">
          <ProtectedCustomerRoute>
            <div className="grid gap-5 lg:grid-cols-[244px_minmax(0,1fr)] lg:gap-6">
              <aside className="grid gap-4 self-start rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 sm:p-5 lg:sticky lg:top-24">
                <div>
                  <p className="text-xs font-bold uppercase text-[#0b5cab]">
                    Customer account
                  </p>
                  <p className="mt-2 text-base font-bold text-[#12314f]">
                    {session?.customer.firstName ?? "Customer"}
                  </p>
                  <p className="mt-1 break-words text-xs font-bold text-[#52677f]">
                    {session?.customer.mobileNumber}
                  </p>
                </div>
                <nav
                  aria-label="Account navigation"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
                >
                  {accountLinks.map((link) => {
                    const Icon = link.icon;

                    return (
                      <Link
                        className={accountLinkClass(link.href, activePath)}
                        href={link.href}
                        key={link.href}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4" />
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

              <section className="grid min-w-0 gap-5">
                <div className="border-b border-[#d6e7f8] pb-4">
                  <h1 className="text-2xl font-bold leading-tight text-[#12314f] sm:text-3xl">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#52677f]">
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

export function AccountInfoGrid({
  items
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5"
          key={item.label}
        >
          <p className="text-xs font-bold uppercase text-[#52677f]">
            {item.label}
          </p>
          <p className="mt-2 break-words text-sm font-bold text-[#12314f]">
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
    <div className="rounded-lg border border-dashed border-[#d6e7f8] bg-white p-6 text-center shadow-sm shadow-[#0b5cab]/5">
      <h2 className="text-base font-bold text-[#12314f]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#52677f]">
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
        "rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5",
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
        <h2 className="text-base font-bold leading-snug text-[#12314f]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm font-semibold leading-5 text-[#52677f]">
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
        "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold",
        tone === "success"
          ? "bg-[#edf7f4] text-[#0f6b50]"
          : "bg-[#edf6ff] text-[#12314f]"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function accountLinkClass(href: string, activePath: string | undefined) {
  const isActive = activePath === href;

  return [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-center text-sm font-bold transition lg:justify-start lg:text-left",
    isActive
      ? "border-[#0b5cab] bg-[#0b5cab] text-white shadow-sm shadow-[#0b5cab]/20"
      : "border-[#d6e7f8] bg-[#f4f9ff] text-[#12314f] hover:border-[#0b5cab] hover:bg-[#edf6ff] hover:text-[#0b5cab]"
  ].join(" ");
}
