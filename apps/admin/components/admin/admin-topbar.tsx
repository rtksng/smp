"use client";

import { useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from "@/components/ui/dropdown";
import { useAdminSession } from "@/lib/admin-session";
import { AdminGlobalSearch } from "./admin-global-search";
import { AdminNotificationBell } from "./admin-notification-bell";
import styles from "./admin-topbar.module.css";

type AdminTopbarProps = {
  isMobileNavigationOpen?: boolean;
  mobileNavigationTriggerRef?: Ref<HTMLButtonElement>;
  onOpenMobileNavigation?: () => void;
};

function useAdminAccount() {
  const { admin, logout } = useAdminSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const name = [admin?.firstName, admin?.lastName].filter(Boolean).join(" ") || "Admin";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // The session store always removes the local session, including offline logout.
    } finally {
      queryClient.clear();
      router.replace("/login");
    }
  }

  return { admin, handleLogout, initials, loggingOut, name };
}

export function AdminTopbar({
  isMobileNavigationOpen = false,
  mobileNavigationTriggerRef,
  onOpenMobileNavigation
}: AdminTopbarProps = {}) {
  const { admin, handleLogout, initials, loggingOut, name } = useAdminAccount();

  return (
    <header className={styles.topbar} aria-label="Admin toolbar">
      <button
        aria-controls="mobile-admin-navigation"
        aria-expanded={isMobileNavigationOpen}
        aria-label="Open navigation"
        className={styles.mobileNavToggle}
        onClick={onOpenMobileNavigation}
        ref={mobileNavigationTriggerRef}
        type="button"
      >
        <Menu aria-hidden size={18} />
      </button>
      <span className={styles.workspaceLabel}>
        <span />
        Workspace
      </span>
      <AdminGlobalSearch key={admin?.id} />
      <div className={styles.actions}>
        <AdminNotificationBell key={admin?.id} />
        <span className={styles.divider} />
        <Dropdown>
          <DropdownTrigger>
            <button
              type="button"
              className={styles.profile}
              aria-label={`Account menu for ${name}`}
              disabled={loggingOut}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initials}
              </span>
              <span className={styles.identity}>
                <strong>{name}</strong>
                <small>{admin?.role.name || "Admin"}</small>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Admin account">
            <DropdownItem
              key="identity"
              isReadOnly
              textValue={admin?.email || name}
              className={styles.accountDetails}
            >
              <strong>{name}</strong>
              <small>{admin?.email}</small>
            </DropdownItem>
            <DropdownItem
              key="logout"
              color="danger"
              startContent={<LogOut size={16} aria-hidden="true" />}
              onPress={() => void handleLogout()}
              isDisabled={loggingOut}
            >
              {loggingOut ? "Logging out…" : "Logout"}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </header>
  );
}

export function AdminMobileAccount() {
  const { admin, handleLogout, initials, loggingOut, name } = useAdminAccount();

  return (
    <footer aria-label="Signed-in admin" className={styles.mobileAccount}>
      <span aria-hidden="true" className={styles.mobileAccountAvatar}>
        {initials}
      </span>
      <span className={styles.mobileAccountIdentity}>
        <strong>{name}</strong>
        <small>{admin?.role.name || "Admin"}</small>
      </span>
      <button
        className={styles.mobileLogout}
        disabled={loggingOut}
        onClick={() => void handleLogout()}
        type="button"
      >
        <LogOut aria-hidden size={16} />
        <span>{loggingOut ? "Logging out…" : "Logout"}</span>
      </button>
    </footer>
  );
}
