"use client";

import {
  ChevronRight,
  Grid2X2,
  Home,
  Search,
  UserRound,
  X,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { CategoryNavigationItem } from "../../lib/catalog/customer-navigation";

type ActiveSheet = "categories" | "search" | null;

type MobileBottomNavigationProps = {
  categories: CategoryNavigationItem[];
};

export function MobileBottomNavigation({ categories }: MobileBottomNavigationProps) {
  const pathname = usePathname();
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const shouldHideOnProductDetail =
    Boolean(pathname?.startsWith("/products/")) && pathname !== "/products";

  if (shouldHideOnProductDetail) {
    return null;
  }

  return (
    <>
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid max-w-full grid-cols-4 overflow-hidden rounded-t-[1.25rem] border border-[#cfe9d2] bg-white px-3 py-1.5 shadow-[0_-10px_25px_rgba(40,124,48,0.12)] md:hidden"
      >
        <BottomNavLink Icon={Home} href="/" label="Home" />
        <BottomNavAction
          fallbackHref="/products"
          Icon={Search}
          isActive={activeSheet === "search"}
          label="Search"
          onClick={() => setActiveSheet("search")}
        />
        <BottomNavAction
          fallbackHref="/#categories"
          Icon={Grid2X2}
          isActive={activeSheet === "categories"}
          label="Categories"
          onClick={() => setActiveSheet("categories")}
        />
        <BottomNavLink Icon={UserRound} href="/account" label="Profile" />
      </nav>

      {activeSheet === "categories" ? (
        <CategorySheet categories={categories} onClose={() => setActiveSheet(null)} />
      ) : null}
      {activeSheet === "search" ? (
        <SearchSheet categories={categories} onClose={() => setActiveSheet(null)} />
      ) : null}
    </>
  );
}

function BottomNavLink({
  Icon,
  href,
  label
}: {
  Icon: LucideIcon;
  href: string;
  label: string;
}) {
  return (
    <Link
      className="grid justify-items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-[#173b1d]"
      href={href}
    >
      <BottomNavIcon Icon={Icon} />
      {label}
    </Link>
  );
}

function BottomNavAction({
  fallbackHref,
  Icon,
  isActive = false,
  label,
  onClick
}: {
  fallbackHref: string;
  Icon: LucideIcon;
  isActive?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <a
      aria-label={`Open ${label.toLowerCase()}`}
      className="relative z-10 grid min-h-14 w-full touch-manipulation justify-items-center gap-0.5 rounded-full bg-transparent px-1.5 py-0.5 text-[10px] font-semibold text-[#173b1d]"
      href={fallbackHref}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      <BottomNavIcon Icon={Icon} isActive={isActive} />
      {label}
    </a>
  );
}

function BottomNavIcon({
  Icon,
  isActive = false
}: {
  Icon: LucideIcon;
  isActive?: boolean;
}) {
  return (
    <span
      className={[
        "grid h-9 w-9 place-items-center rounded-full",
        isActive ? "bg-[#287c30] text-white" : "text-[#173b1d]"
      ].join(" ")}
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
    </span>
  );
}

function CategorySheet({
  categories,
  onClose
}: {
  categories: CategoryNavigationItem[];
  onClose: () => void;
}) {
  return (
    <MobileSheet label="Browse categories" onClose={onClose}>
      <div className="grid max-h-[62vh] gap-2 overflow-y-auto px-4 pb-5">
        {categories.map((category) => (
          <Link
            className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#cfe9d2] bg-[#f8fcf8] px-4 text-sm font-semibold text-[#173b1d]"
            href={category.href}
            key={category.id}
          >
            <span className="min-w-0 truncate">{category.label}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
        ))}
      </div>
    </MobileSheet>
  );
}

function SearchSheet({
  categories,
  onClose
}: {
  categories: CategoryNavigationItem[];
  onClose: () => void;
}) {
  return (
    <MobileSheet
      fullScreen
      label="Search catalog"
      onClose={onClose}
    >
      <form action="/products" className="grid gap-5 px-4 pb-6">
        <label className="grid gap-2 text-sm font-semibold text-[#173b1d]">
          Search products or SKU
          <span className="grid min-h-12 grid-cols-[1fr_auto] items-center rounded-full border border-[#287c30] bg-white px-4">
            <input
              autoFocus
              className="min-w-0 bg-transparent text-sm font-semibold outline-none"
              name="q"
              placeholder="Search catalog"
              type="search"
            />
            <button
              aria-label="Search catalog"
              className="grid h-9 w-9 place-items-center text-[#173b1d]"
              type="submit"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </button>
          </span>
        </label>
        {categories.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase text-[#556b57]">
              Browse categories
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 6).map((category) => (
                <Link
                  className="rounded-full border border-[#cfe9d2] bg-[#f8fcf8] px-3 py-2 text-xs font-semibold text-[#173b1d]"
                  href={category.href}
                  key={category.id}
                >
                  {category.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </MobileSheet>
  );
}

function MobileSheet({
  children,
  fullScreen = false,
  label,
  onClose
}: {
  children: ReactNode;
  fullScreen?: boolean;
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        aria-label="Close"
        className="absolute inset-0 h-full w-full bg-[#0f172a]/35"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={label}
        aria-modal="true"
        className={[
          "overflow-hidden bg-white shadow-2xl",
          fullScreen
            ? "fixed inset-0 flex h-dvh w-dvw flex-col rounded-none"
            : "absolute inset-x-0 bottom-0 rounded-t-[1.5rem]"
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <h2 className="text-xl font-black text-[#111827]">{label}</h2>
          <button
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#cfe9d2] text-[#173b1d]"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
