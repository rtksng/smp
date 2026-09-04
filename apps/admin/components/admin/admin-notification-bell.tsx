"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  CheckCheck,
  FileText,
  MessageSquare,
  Package,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  Truck,
  UserRound,
  Warehouse,
  X
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { useAdminSession } from "@/lib/admin-session";
import {
  loadAdminNotificationFeed,
  mergeNotificationReadIds,
  notificationReadStorageKey,
  parseNotificationReadIds,
  type AdminNotificationKind
} from "@/lib/admin-notification-feed";
import styles from "./admin-notification-bell.module.css";

const READ_CHANGE_EVENT = "smp:admin-notification-reads-changed";
const notificationIcons = {
  order: Package,
  return: RotateCcw,
  quote: FileText,
  inventory: TriangleAlert,
  delivery: Truck,
  feedback: MessageSquare,
  warehouse: Warehouse,
  customer: UserRound,
  report: FileText
};

export function AdminNotificationBell() {
  const { admin, api } = useAdminSession();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const permissionKey = [...(admin?.permissions ?? [])].sort().join(",");
  const permissions = useMemo(
    () => permissionKey.split(",").filter(Boolean),
    [permissionKey]
  );
  const { readIds, markRead, isPersistent } = useNotificationReads(admin?.id ?? "");
  const feed = useQuery({
    queryKey: ["admin", "notification-feed", admin?.id, permissionKey],
    queryFn: ({ signal }) => loadAdminNotificationFeed(api, permissions, signal),
    enabled: Boolean(admin),
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
    staleTime: 30_000,
    retry: false
  });
  const items = feed.data?.items ?? [];
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = items.filter((item) => !readSet.has(item.id)).length;
  const visibleItems = unreadOnly
    ? items.filter((item) => !readSet.has(item.id))
    : items;
  const failedSources = feed.data?.failedSources ?? [];
  const hasError = feed.isError || failedSources.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
    function dismissOutside(event: Event) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target))
        setIsOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [isOpen]);

  function closeAndRestoreFocus() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      className={styles.root}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          closeAndRestoreFocus();
        }
      }}
    >
      <button
        aria-controls={isOpen ? panelId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}${hasError ? ", some updates unavailable" : ""}`}
        className={styles.trigger}
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
      >
        <Bell aria-hidden="true" size={20} />
        {unreadCount > 0 && (
          <span aria-hidden="true" className={styles.badge}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {hasError && unreadCount === 0 && (
          <span aria-hidden="true" className={styles.errorDot} />
        )}
      </button>
      {isOpen && (
        <div
          aria-labelledby={`${panelId}-title`}
          className={styles.panel}
          id={panelId}
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className={styles.heading}>
            <div>
              <h2 id={`${panelId}-title`}>Notifications</h2>
              <p>{unreadCount} unread in your current feed</p>
            </div>
            <div className={styles.actions}>
              <button
                aria-label="Refresh notifications"
                className={styles.iconButton}
                disabled={feed.isFetching}
                onClick={() => void feed.refetch()}
                type="button"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={feed.isFetching ? styles.spin : undefined}
                  size={16}
                />
              </button>
              <button
                aria-label="Close notifications"
                className={styles.iconButton}
                onClick={closeAndRestoreFocus}
                type="button"
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          </div>
          <div className={styles.toolbar}>
            <div aria-label="Filter notifications" className={styles.filters}>
              <button
                aria-pressed={!unreadOnly}
                className={styles.filter}
                onClick={() => setUnreadOnly(false)}
                type="button"
              >
                All
              </button>
              <button
                aria-pressed={unreadOnly}
                className={styles.filter}
                onClick={() => setUnreadOnly(true)}
                type="button"
              >
                Unread
              </button>
            </div>
            <button
              className={styles.textButton}
              disabled={unreadCount === 0}
              onClick={() => markRead(items.map((item) => item.id))}
              type="button"
            >
              Mark all as read
            </button>
          </div>
          {hasError && (
            <p className={styles.notice} role="status">
              {failedSources.length
                ? `${failedSources.join(", ")} could not be loaded.`
                : "Notifications could not be refreshed."}{" "}
              Use refresh to try again.
            </p>
          )}
          {feed.isPending ? (
            <div className={styles.empty} role="status">
              Loading notifications...
            </div>
          ) : visibleItems.length > 0 ? (
            <ul aria-label="Current notifications" className={styles.list}>
              {visibleItems.map((item) => {
                const unread = !readSet.has(item.id);
                return (
                  <li key={item.id}>
                    <Link
                      className={`${styles.item} ${unread ? styles.unread : ""}`}
                      href={item.href}
                      onClick={() => {
                        markRead([item.id]);
                        setIsOpen(false);
                      }}
                    >
                      <NotificationIcon kind={item.kind} />
                      <div className={styles.itemContent}>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                        {item.occurredAt ? (
                          <time dateTime={item.occurredAt}>
                            {new Date(item.occurredAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </time>
                        ) : (
                          <span className={styles.current}>
                            Current{" "}
                            {item.kind === "report"
                              ? "report summary"
                              : "inventory status"}
                          </span>
                        )}
                      </div>
                      {unread && (
                        <span aria-label="Unread" className={styles.unreadDot} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>
              {unreadOnly && items.length ? (
                <CheckCheck aria-hidden="true" size={28} />
              ) : (
                <BellRing aria-hidden="true" size={28} />
              )}
              <strong>
                {hasError
                  ? "Some updates are unavailable"
                  : unreadOnly && items.length
                    ? "You’re all caught up"
                    : "No notifications right now"}
              </strong>
              <p>
                {feed.data?.sourceCount === 0
                  ? "No alert sources are available for your role."
                  : hasError
                    ? "Refresh to check the unavailable sources."
                    : unreadOnly && items.length
                      ? "Switch to All to view your current feed."
                      : "New operational alerts will appear here."}
              </p>
            </div>
          )}
          <div className={styles.footer}>
            <p>
              Up to 20 alerts from your permitted queues, with the latest 5 checked per
              queue. Refreshes every minute.
            </p>
            <p>
              {isPersistent
                ? "Read status saved in this browser."
                : "Browser storage is unavailable. Read status lasts for this session."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationIcon({ kind }: { kind: AdminNotificationKind }) {
  const Icon = notificationIcons[kind];
  return (
    <span className={styles.itemIcon} data-kind={kind}>
      <Icon aria-hidden="true" size={16} />
    </span>
  );
}

function useNotificationReads(adminId: string) {
  const storageKey = notificationReadStorageKey(adminId);
  const [fallback, setFallback] = useState<{ key: string; ids: string[] } | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey || event.key === null) onChange();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(READ_CHANGE_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(READ_CHANGE_EVENT, onChange);
      };
    },
    [storageKey]
  );
  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  }, [storageKey]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const storedIds = useMemo(() => parseNotificationReadIds(snapshot), [snapshot]);
  const readIds = fallback?.key === storageKey ? fallback.ids : storedIds;

  function markRead(ids: string[]) {
    const merged = mergeNotificationReadIds(
      [...parseNotificationReadIds(getSnapshot()), ...readIds],
      ids
    );
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(merged));
      window.dispatchEvent(new Event(READ_CHANGE_EVENT));
      setFallback(null);
    } catch {
      setFallback({ key: storageKey, ids: merged });
    }
  }

  return { readIds, markRead, isPersistent: fallback?.key !== storageKey };
}
