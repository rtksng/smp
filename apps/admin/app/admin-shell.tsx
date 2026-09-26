"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Badge,
  BarChart3,
  BookOpenCheck,
  Boxes,
  Circle,
  CircleDollarSign,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  MessageSquareHeart,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users,
  Warehouse,
  X,
  type LucideIcon
} from "lucide-react";
import { AdminMobileAccount, AdminTopbar } from "@/components/admin/admin-topbar";
import topbarStyles from "@/components/admin/admin-topbar.module.css";
import { ProtectedRoute, useAdminSession } from "../lib/admin-session";
import { getVisibleNavigationItems, type AdminNavigationItem } from "../lib/navigation";

const navIconMap: Record<string, LucideIcon> = {
  Brands: Badge,
  "Admin Guide": BookOpenCheck,
  Categories: FolderTree,
  Coupons: TicketPercent,
  Customers: Users,
  Dashboard: LayoutDashboard,
  Delivery: Truck,
  "Delivery Charges": CircleDollarSign,
  Inventory: Boxes,
  Orders: ShoppingCart,
  Products: Package,
  "Product Feedback": MessageSquareHeart,
  "Quote Requests": ClipboardList,
  Reports: BarChart3,
  "Returns & Refunds": ReceiptText,
  Settings,
  Warehouses: Warehouse
};
const SIDEBAR_SCROLL_STORAGE_KEY = "surgical.admin.sidebarScrollTop";
const MOBILE_SIDEBAR_SCROLL_STORAGE_KEY = "surgical.admin.mobileSidebarScrollTop";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "surgical.admin.sidebarCollapsed";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { admin } = useAdminSession();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileNavCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarAnimationFrameRef = useRef<number | null>(null);
  const sidebarMotionRef = useRef<Animation[]>([]);
  const visibleNavItems = getVisibleNavigationItems(admin?.permissions);

  useEffect(() => {
    try {
      setIsSidebarCollapsed(
        window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
      );
    } catch {
      // Keep the expanded default when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(sidebarAnimationFrameRef.current);
      }
      sidebarMotionRef.current.forEach((animation) => animation.cancel());
    };
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const desktopQuery = window.matchMedia?.("(min-width: 981px)");
    const mobileNavTrigger = mobileNavTriggerRef.current;

    document.body.style.overflow = "hidden";
    mobileNavCloseRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileNavOpen(false);
      }
    }

    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) {
        setIsMobileNavOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    desktopQuery?.addEventListener("change", closeOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      desktopQuery?.removeEventListener("change", closeOnDesktop);
      mobileNavTrigger?.focus();
    };
  }, [isMobileNavOpen]);

  function toggleSidebar() {
    const nextValue = !isSidebarCollapsed;
    const shell = shellRef.current;
    const motionTargets = shell
      ? [
          shell.querySelector<HTMLElement>(".workspace"),
          shell.querySelector<HTMLElement>('[aria-label="Admin toolbar"]')
        ].filter((target): target is HTMLElement => target !== null)
      : [];
    const startLefts = motionTargets.map(
      (target) => target.getBoundingClientRect().left
    );
    const shouldAnimate =
      motionTargets.length > 0 &&
      motionTargets.every((target) => typeof target.animate === "function") &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (sidebarAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(sidebarAnimationFrameRef.current);
    }
    sidebarMotionRef.current.forEach((animation) => animation.cancel());
    sidebarMotionRef.current = [];

    setIsSidebarCollapsed(nextValue);

    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue));
    } catch {
      // The control still works for this visit when storage is unavailable.
    }

    if (!shouldAnimate) {
      return;
    }

    sidebarAnimationFrameRef.current = window.requestAnimationFrame(() => {
      sidebarMotionRef.current = motionTargets.flatMap((target, index) => {
        const offset = startLefts[index]! - target.getBoundingClientRect().left;

        if (Math.abs(offset) < 1) {
          return [];
        }

        return [
          target.animate(
            [
              { transform: `translate3d(${offset}px, 0, 0)` },
              { transform: "translate3d(0, 0, 0)" }
            ],
            {
              duration: 300,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)"
            }
          )
        ];
      });
      sidebarAnimationFrameRef.current = null;
    });
  }

  return (
    <ProtectedRoute>
      <main
        className={`shell${isSidebarCollapsed ? " sidebarCollapsed" : ""}`}
        ref={shellRef}
      >
        <aside
          className={`sidebar${isSidebarCollapsed ? " sidebar--collapsed" : ""}`}
          id="admin-sidebar"
        >
          <div className="sidebarHeader">
            <SidebarBrand />
            <button
              aria-controls="admin-sidebar"
              aria-expanded={!isSidebarCollapsed}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="sidebarCollapseToggle"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen aria-hidden size={18} />
              ) : (
                <PanelLeftClose aria-hidden size={18} />
              )}
            </button>
          </div>
          <SidebarNavScroller
            restoreKey={pathname}
            storageKey={SIDEBAR_SCROLL_STORAGE_KEY}
          >
            {renderNavigation(visibleNavItems, pathname, undefined, isSidebarCollapsed)}
          </SidebarNavScroller>
        </aside>

        <div
          aria-hidden={!isMobileNavOpen}
          className={`mobileNavOverlay${isMobileNavOpen ? " mobileNavOverlay--open" : ""}`}
        >
          <button
            aria-label="Close navigation"
            className="mobileNavBackdrop"
            onClick={() => setIsMobileNavOpen(false)}
            tabIndex={isMobileNavOpen ? 0 : -1}
            type="button"
          />
          <aside
            aria-label="Admin navigation menu"
            aria-modal="true"
            className="mobileNavDrawer"
            id="mobile-admin-navigation"
            role="dialog"
          >
            <div className="mobileNavDrawerHeader">
              <SidebarBrand />
              <button
                aria-label="Close navigation"
                className="mobileNavClose"
                onClick={() => setIsMobileNavOpen(false)}
                ref={mobileNavCloseRef}
                tabIndex={isMobileNavOpen ? 0 : -1}
                type="button"
              >
                <X aria-hidden size={19} />
              </button>
            </div>
            <SidebarNavScroller
              restoreKey={pathname}
              storageKey={MOBILE_SIDEBAR_SCROLL_STORAGE_KEY}
            >
              {renderNavigation(visibleNavItems, pathname, () =>
                setIsMobileNavOpen(false)
              )}
            </SidebarNavScroller>
            <AdminMobileAccount />
          </aside>
        </div>

        <AdminTopbar
          isMobileNavigationOpen={isMobileNavOpen}
          mobileNavigationTriggerRef={mobileNavTriggerRef}
          onOpenMobileNavigation={() => setIsMobileNavOpen(true)}
        />
        <section className={`workspace ${topbarStyles.workspace}`}>{children}</section>
      </main>
    </ProtectedRoute>
  );
}

function SidebarNavScroller({
  children,
  restoreKey,
  storageKey
}: {
  children: ReactNode;
  restoreKey: string;
  storageKey: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const storedScrollTop = Number(window.sessionStorage.getItem(storageKey));

    if (!Number.isFinite(storedScrollTop)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTop = storedScrollTop;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [restoreKey, storageKey]);

  return (
    <div
      className="sidebarNavScroller"
      onScroll={(event) => {
        window.sessionStorage.setItem(
          storageKey,
          String(event.currentTarget.scrollTop)
        );
      }}
      ref={scrollerRef}
    >
      {children}
    </div>
  );
}

function SidebarBrand() {
  return (
    <div className="sidebarBrandLogo">
      <Image
        alt="Hospi Surgical Division"
        height={46}
        sizes="116px"
        src="/brand/hospisurgical.png"
        width={116}
      />
    </div>
  );
}

function renderNavigation(
  visibleNavItems: ReturnType<typeof getVisibleNavigationItems>,
  pathname: string,
  onNavigate?: () => void,
  isCollapsed = false
) {
  const navigationSections = visibleNavItems.reduce<
    Array<{ label: AdminNavigationItem["category"]; items: AdminNavigationItem[] }>
  >((sections, item) => {
    const section = sections.find(({ label }) => label === item.category);

    if (section) {
      section.items.push(item);
      return sections;
    }

    sections.push({ label: item.category, items: [item] });
    return sections;
  }, []);

  return (
    <nav aria-label="Admin navigation">
      {navigationSections.map((section) => (
        <section
          aria-labelledby={`navigation-${section.label}`}
          className="sidebarNavSection"
          key={section.label}
        >
          <h2 className="sidebarNavSectionLabel" id={`navigation-${section.label}`}>
            {section.label}
          </h2>
          <div className="sidebarNavSectionLinks">
            {section.items.map((item) => (
              <NavigationGroup
                isCollapsed={isCollapsed}
                item={item}
                key={item.href}
                onNavigate={onNavigate}
                pathname={pathname}
              />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

function NavigationGroup({
  isCollapsed,
  item,
  onNavigate,
  pathname
}: {
  isCollapsed: boolean;
  item: AdminNavigationItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const Icon = navIconMap[item.label] ?? Circle;

  return (
    <div className="sidebarNavGroup">
      <Link
        aria-label={isCollapsed ? item.label : undefined}
        aria-current={pathname === item.href ? "page" : undefined}
        className="sidebarNavLink"
        href={item.href}
        onClick={onNavigate}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon aria-hidden size={17} />
        <span>{item.label}</span>
      </Link>
      {item.children?.length && isActivePath(pathname, item.href) ? (
        <div className="sidebarSubnav">
          {item.children.map((child) => (
            <Link
              aria-current={isActivePath(pathname, child.href) ? "page" : undefined}
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
