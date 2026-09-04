import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationReadStorageKey } from "@/lib/admin-notification-feed";
import { AdminNotificationBell } from "./admin-notification-bell";

const { request, session } = vi.hoisted(() => ({
  request: vi.fn(),
  session: { id: "admin-1", permissions: ["settings.manage"] }
}));
vi.mock("@/lib/admin-session", () => ({
  useAdminSession: () => ({ admin: session, api: { request } })
}));

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminNotificationBell />
    </QueryClientProvider>
  );
}

describe("AdminNotificationBell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    request.mockReset();
    request.mockResolvedValue({
      items: [
        {
          id: "quote-1",
          name: "Asha",
          status: "NEW",
          organization: "Clinic",
          createdAt: "2026-09-03T10:00:00Z"
        }
      ],
      pagination: { total: 1 }
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("marks the loaded feed as read, persists it, filters unread and restores focus on Escape", async () => {
    const view = renderBell();
    const trigger = await screen.findByRole("button", {
      name: "Notifications, 1 unread"
    }, { timeout: 5000 });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Notifications" })).toHaveFocus();
    expect(screen.getByRole("link", { name: /New quote from Asha/ })).toHaveAttribute(
      "href",
      "/quote-requests/quote-1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(
      window.localStorage.getItem(notificationReadStorageKey("admin-1"))
    ).toContain("quote:quote-1:NEW");
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(screen.getByText("You’re all caught up")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    view.unmount();
    renderBell();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("syncs another browser tab's read status and closes on outside click", async () => {
    renderBell();
    fireEvent.click(
      await screen.findByRole("button", { name: "Notifications, 1 unread" })
    );
    const key = notificationReadStorageKey("admin-1");
    window.localStorage.setItem(key, '["quote:quote-1:NEW"]');
    fireEvent(window, new StorageEvent("storage", { key }));
    expect(screen.getByText("0 unread in your current feed")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows manual retry of an unavailable source", async () => {
    request.mockRejectedValueOnce(new Error("Unavailable"));
    renderBell();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Notifications, some updates unavailable"
      })
    );
    expect(
      screen.getByText(/New quote requests could not be loaded/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh notifications" }));
    expect(
      await screen.findByRole("link", { name: /New quote from Asha/ })
    ).toBeInTheDocument();
  });
});
