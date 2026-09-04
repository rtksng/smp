import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTopbar } from "./admin-topbar";

const mocks = vi.hoisted(() => ({ logout: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/admin-session", () => ({
  useAdminSession: () => ({
    admin: {
      id: "admin-header-test",
      firstName: "Nisha",
      lastName: "Kapoor",
      email: "nisha@example.test",
      role: { name: "Order manager" }
    },
    logout: mocks.logout
  })
}));
vi.mock("./admin-global-search", () => ({
  AdminGlobalSearch: () => <input aria-label="Search admin" />
}));
vi.mock("./admin-notification-bell", () => ({
  AdminNotificationBell: () => <button type="button">Notifications</button>
}));

function renderTopbar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["admin", "private-records"], { name: "Cached customer" });
  const clear = vi.spyOn(client, "clear");
  render(
    <QueryClientProvider client={client}>
      <AdminTopbar />
    </QueryClientProvider>
  );
  return { client, clear };
}

describe("AdminTopbar", () => {
  beforeEach(() => {
    mocks.logout.mockReset().mockResolvedValue(undefined);
    mocks.replace.mockReset();
  });

  it("uses the signed-in admin identity and opens the real account dropdown", async () => {
    renderTopbar();
    const profile = screen.getByRole("button", {
      name: "Account menu for Nisha Kapoor"
    });
    expect(profile).toHaveTextContent("NK");
    expect(profile).toHaveTextContent("Nisha Kapoor");
    expect(profile).toHaveTextContent("Order manager");
    expect(screen.queryByRole("menuitem", { name: "Logout" })).not.toBeInTheDocument();

    fireEvent.click(profile);

    const menu = await screen.findByRole("menu", {
      name: "Account menu for Nisha Kapoor"
    });
    expect(within(menu).getByText("nisha@example.test")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  });

  it.each([false, true])(
    "clears admin caches and redirects after logout (revocation failure: %s)",
    async (fails) => {
      if (fails) mocks.logout.mockRejectedValueOnce(new Error("Backend unavailable"));
      const { client, clear } = renderTopbar();
      fireEvent.click(
        screen.getByRole("button", { name: "Account menu for Nisha Kapoor" })
      );
      fireEvent.click(await screen.findByRole("menuitem", { name: "Logout" }));

      await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
      expect(mocks.logout).toHaveBeenCalledTimes(1);
      expect(clear).toHaveBeenCalledTimes(1);
      expect(client.getQueryData(["admin", "private-records"])).toBeUndefined();
      expect(
        screen.getByRole("button", { name: "Account menu for Nisha Kapoor" })
      ).toBeDisabled();
    }
  );
});
