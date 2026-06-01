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

  const adminDisplayName = admin
    ? formatAdminName(admin.firstName, admin.lastName)
    : "Admin";
  const adminInitials = admin
    ? getAdminInitials(admin.firstName, admin.lastName)
    : "AD";

  return (
    <ProtectedRoute>
      <main className="shell">
        <aside className="sidebar">
          <div className="brandBlock">
            <span className="brandMark">SMEP</span>
            <span className="brand">{APP_NAMES.admin}</span>
          </div>
          <div className="sidebarNavScroller">
            <nav aria-label="Admin navigation">
              {visibleNavItems.map((item) => (
                <div className="sidebarNavGroup" key={item.href}>
                  <Link
                    aria-current={pathname === item.href ? "page" : undefined}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                  {item.children?.length && isActivePath(pathname, item.href) ? (
                    <div className="sidebarSubnav">
                      {item.children.map((child) => (
                        <Link
                          aria-current={
                            isActivePath(pathname, child.href) ? "page" : undefined
                          }
                          href={child.href}
                          key={child.href}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>
          </div>
          <div className="sidebarFooter">
            <div className="sidebarAdminIdentity">
              <span aria-hidden className="sidebarAvatar">
                {adminInitials}
              </span>
              <div>
                <strong>{adminDisplayName}</strong>
                <span>{admin?.role.name ?? "Admin"}</span>
                {admin?.email ? <small>{admin.email}</small> : null}
              </div>
            </div>
            <button
              aria-label="Log out"
              className="ghostButton iconTextButton sidebarLogoutButton"
              onClick={handleLogout}
              type="button"
            >
              <LogOut aria-hidden size={16} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <section className="workspace">{children}</section>
      </main>
    </ProtectedRoute>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatAdminName(firstName: string, lastName: string | null) {
  return [firstName, lastName].filter(isStringValue).join(" ");
}

function getAdminInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(isStringValue)
    .map((name) => name.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function isStringValue(value: string | null): value is string {
  return Boolean(value);
}
