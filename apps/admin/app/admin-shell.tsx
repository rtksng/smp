"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { APP_NAMES } from "@surgical/config";
import { ProtectedRoute, useAdminSession } from "../lib/admin-session";
import { getVisibleNavigationItems } from "../lib/navigation";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdminSession();
  const visibleNavItems = getVisibleNavigationItems(admin?.permissions);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <ProtectedRoute>
      <main className="shell">
        <aside className="sidebar">
          <div className="brandBlock">
            <span className="brandMark">SMEP</span>
            <span className="brand">{APP_NAMES.admin}</span>
          </div>
          <nav aria-label="Admin navigation">
            {visibleNavItems.map((item) => (
              <Link
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow">Admin operations</p>
              <h1>{admin ? `${admin.firstName}'s workspace` : "Admin workspace"}</h1>
            </div>
            <div className="adminIdentity">
              <span>{admin?.role.name}</span>
              <strong>{admin?.email}</strong>
              <button
                aria-label="Log out"
                className="ghostButton iconTextButton"
                onClick={handleLogout}
                type="button"
              >
                <LogOut aria-hidden size={16} />
                <span>Logout</span>
              </button>
            </div>
          </header>
          {children}
        </section>
      </main>
    </ProtectedRoute>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
