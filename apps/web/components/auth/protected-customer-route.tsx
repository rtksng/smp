"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { customerLoginHref } from "../../lib/auth/routes";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { SectionLoader } from "../ui/loading-spinner";

export function ProtectedCustomerRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHydrated = useCustomerAuthStore((state) => state.isHydrated);
  const session = useCustomerAuthStore((state) => state.session);

  useEffect(() => {
    if (!isHydrated || session) {
      return;
    }

    const currentPath =
      typeof window === "undefined"
        ? pathname
        : `${window.location.pathname}${window.location.search}`;

    router.replace(customerLoginHref(currentPath));
  }, [isHydrated, pathname, router, session]);

  if (!isHydrated) {
    return <SectionLoader label="Loading session" />;
  }

  if (!session) {
    return <SectionLoader label="Redirecting to login" />;
  }

  return children;
}
