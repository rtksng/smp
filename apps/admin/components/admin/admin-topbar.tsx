"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut } from "lucide-react";
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

export function AdminTopbar() {
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

  return (
    <header className={styles.topbar} aria-label="Admin toolbar">
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
