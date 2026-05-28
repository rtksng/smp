"use client";

import type { ReactNode } from "react";
import { LogOut, MapPin, Package, UserRound } from "lucide-react";
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
      <main className="bg-[#f5f8f7]">
        <Container className="py-8">
          <ProtectedCustomerRoute>
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <aside className="grid gap-4 self-start rounded-lg border border-[#d8e2df] bg-white p-4 sm:p-5 lg:sticky lg:top-24">
                <div>
                  <p className="text-xs font-extrabold uppercase text-[#9b6a1e]">
                    Customer account
                  </p>
                  <p className="mt-2 text-lg font-extrabold text-[#17211f]">
                    {session?.customer.firstName ?? "Customer"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#687773]">
                    {session?.customer.mobileNumber}
                  </p>
                </div>
                <nav
                  className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-1"
                  aria-label="Account navigation"
                >
                  <Link
                    className={accountLinkClass("/account", activePath)}
                    href="/account"
                  >
                    <UserRound aria-hidden="true" className="h-4 w-4" />
                    Overview
                  </Link>
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

              <section className="grid gap-5 rounded-lg border border-[#d8e2df] bg-white p-5 sm:p-6">
                <div>
                  <p className="text-xs font-extrabold uppercase text-[#9b6a1e]">
                    Private area
                  </p>
                  <h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#17211f]">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687773]">
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
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          className="rounded-lg border border-[#d8e2df] bg-[#f8fbfa] p-4"
          key={item.label}
        >
          <p className="text-xs font-extrabold uppercase text-[#687773]">
            {item.label}
          </p>
          <p className="mt-2 text-sm font-extrabold text-[#17211f]">
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
    <div className="rounded-lg border border-dashed border-[#cfdcda] bg-[#f8fbfa] p-6 text-center">
      <h2 className="text-lg font-extrabold text-[#17211f]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#687773]">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function accountLinkClass(href: string, activePath: string | undefined) {
  const isActive = activePath === href;

  return [
    "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-center text-sm font-extrabold transition sm:shrink lg:justify-start lg:text-left",
    isActive
      ? "bg-[#006d77] text-white"
      : "bg-[#eef3f1] text-[#31413d] hover:bg-[#e7f3f2]"
  ].join(" ");
}
