"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Badge,
  BarChart3,
  Boxes,
  Circle,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  type LucideIcon
} from "lucide-react";
import { APP_NAMES } from "@surgical/config";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader
} from "@/components/ui/drawer";
import { ProtectedRoute, useAdminSession } from "../lib/admin-session";
import {
  getVisibleNavigationItems,
  type AdminNavigationItem
} from "../lib/navigation";

const navIconMap: Record<string, LucideIcon> = {
  Brands: Badge,
  Categories: FolderTree,
  Customers: Users,
  Dashboard: LayoutDashboard,
  Delivery: Truck,
  Inventory: Boxes,
  Orders: ShoppingCart,
  Products: Package,
  Reports: BarChart3,
  Settings,
  Warehouses: Warehouse
};

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdminSession();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
        <div className="mobileNavBar">
          <div className="brandBlock">
            <span className="brandMark">SMEP</span>
            <span className="brand">{APP_NAMES.admin}</span>
          </div>
          <Button
            aria-label="Open navigation"
            className="mobileNavToggle"
            onClick={() => setIsMobileNavOpen(true)}
            size="icon"
            type="button"
            variant="outline"
          >
            <Menu aria-hidden size={18} />
          </Button>
        </div>

        <aside className="sidebar">
          <SidebarBrand />
          <div className="sidebarNavScroller">
            {renderNavigation(visibleNavItems, pathname)}
          </div>
          <SidebarFooter
            adminDisplayName={adminDisplayName}
            adminEmail={admin?.email}
            adminInitials={adminInitials}
            adminRole={admin?.role.name ?? "Admin"}
            onLogout={handleLogout}
          />
        </aside>

        <Drawer
          className="mobileNavDrawer"
          isOpen={isMobileNavOpen}
          onOpenChange={setIsMobileNavOpen}
          placement="left"
        >
          <DrawerContent>
            <DrawerHeader>
              <SidebarBrand />
            </DrawerHeader>
            <DrawerBody>
              <div className="sidebarNavScroller">
                {renderNavigation(visibleNavItems, pathname, () =>
                  setIsMobileNavOpen(false)
                )}
              </div>
              <SidebarFooter
                adminDisplayName={adminDisplayName}
                adminEmail={admin?.email}
                adminInitials={adminInitials}
                adminRole={admin?.role.name ?? "Admin"}
                onLogout={handleLogout}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        <section className="workspace">{children}</section>
      </main>
    </ProtectedRoute>
  );
}

function SidebarBrand() {
  return (
    <div className="brandBlock">
      <span className="brandMark">SMEP</span>
      <span className="brand">{APP_NAMES.admin}</span>
    </div>
  );
}

function SidebarFooter({
  adminDisplayName,
  adminEmail,
  adminInitials,
  adminRole,
  onLogout
}: {
  adminDisplayName: string;
  adminEmail?: string;
  adminInitials: string;
  adminRole: string;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="sidebarFooter">
      <div className="sidebarAdminIdentity">
        <span aria-hidden className="sidebarAvatar">
          {adminInitials}
        </span>
        <div>
          <strong>{adminDisplayName}</strong>
          <span>{adminRole}</span>
          {adminEmail ? <small>{adminEmail}</small> : null}
        </div>
      </div>
      <Button
        aria-label="Log out"
        className="iconTextButton sidebarLogoutButton"
        onClick={() => void onLogout()}
        type="button"
        variant="ghost"
      >
        <LogOut aria-hidden size={16} />
        <span>Logout</span>
      </Button>
    </div>
  );
}

function renderNavigation(
  visibleNavItems: ReturnType<typeof getVisibleNavigationItems>,
  pathname: string,
  onNavigate?: () => void
) {
  return (
    <nav aria-label="Admin navigation">
      {visibleNavItems.map((item) => (
        <NavigationGroup
          item={item}
          key={item.href}
          onNavigate={onNavigate}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

function NavigationGroup({
  item,
  onNavigate,
  pathname
}: {
  item: AdminNavigationItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const Icon = navIconMap[item.label] ?? Circle;

  return (
    <div className="sidebarNavGroup">
      <Link
        aria-current={pathname === item.href ? "page" : undefined}
        className="sidebarNavLink"
        href={item.href}
        onClick={onNavigate}
      >
        <Icon aria-hidden size={17} />
        <span>{item.label}</span>
      </Link>
      {item.children?.length && isActivePath(pathname, item.href) ? (
        <div className="sidebarSubnav">
          {item.children.map((child) => (
            <Link
              aria-current={
                isActivePath(pathname, child.href) ? "page" : undefined
              }
              className="sidebarNavLink sidebarSubnavLink"
              href={child.href}
              key={child.href}
              onClick={onNavigate}
            >
              <Circle aria-hidden size={8} />
              <span>{child.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
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
