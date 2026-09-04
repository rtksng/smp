"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  requestAdminApi,
  requestAdminApiResponse,
  type AdminApiRequestOptions
} from "./admin-api";
import { useAdminAuthStore } from "./auth-store";
import { hasPermission } from "./permissions";

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useAdminSession() {
  const session = useAdminAuthStore((state) => state.session);
  const isHydrated = useAdminAuthStore((state) => state.isHydrated);
  const login = useAdminAuthStore((state) => state.login);
  const logout = useAdminAuthStore((state) => state.logout);

  const api = useMemo(
    () => ({
      request: <T,>(path: string, init: AdminApiRequestOptions = {}) =>
        requestAdminApi<T>(path, {
          ...init,
          auth: {
            clearSession: useAdminAuthStore.getState().clearSession,
            getSession: () => useAdminAuthStore.getState().session,
            refreshSession: () => useAdminAuthStore.getState().refreshSession()
          }
        }),
      requestResponse: (path: string, init: AdminApiRequestOptions = {}) =>
        requestAdminApiResponse(path, {
          ...init,
          auth: {
            clearSession: useAdminAuthStore.getState().clearSession,
            getSession: () => useAdminAuthStore.getState().session,
            refreshSession: () => useAdminAuthStore.getState().refreshSession()
          }
        })
    }),
    []
  );

  return {
    admin: session?.admin ?? null,
    api,
    hasPermission: (permission: string) =>
      hasPermission(session?.admin.permissions, permission),
    isLoading: !isHydrated,
    login,
    logout,
    session
  };
}

export function ProtectedRoute({
  children,
  permission
}: {
  children: ReactNode;
  permission?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission: canAccess, isLoading, session } = useAdminSession();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, pathname, router, session]);

  if (isLoading) {
    return <main className="stateScreen">Loading session...</main>;
  }

  if (!session) {
    return <main className="stateScreen">Redirecting to login...</main>;
  }

  if (permission && !canAccess(permission)) {
    return (
      <main className="stateScreen">
        <h1>Access restricted</h1>
        <p>Your admin role does not include the required permission.</p>
      </main>
    );
  }

  return children;
}

export function PermissionGate({
  children,
  permission,
  fallback = null
}: {
  children: ReactNode;
  fallback?: ReactNode;
  permission: string;
}) {
  const { hasPermission: canAccess } = useAdminSession();

  return canAccess(permission) ? children : fallback;
}
