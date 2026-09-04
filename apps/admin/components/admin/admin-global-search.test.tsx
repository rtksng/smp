import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PERMISSION as P } from "@/lib/permissions";
import { getAdminSearchPages, type AdminSearchResult } from "@/lib/admin-global-search";
import { AdminGlobalSearch } from "./admin-global-search";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  search: vi.fn(),
  api: { request: vi.fn() },
  admin: { id: "admin-search-test", permissions: [] as string[] }
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/admin-session", () => ({
  useAdminSession: () => ({ admin: mocks.admin, api: mocks.api })
}));
vi.mock("@/lib/admin-global-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-global-search")>()),
  searchAdmin: mocks.search
}));

type SearchResponse = { results: AdminSearchResult[]; unavailable: string[] };

const record = (title: string): AdminSearchResult => ({
  id: `order:${title}`,
  title,
  description: "Confirmed order",
  href: `/orders/${encodeURIComponent(title)}`,
  group: "Orders"
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const clients: QueryClient[] = [];

function renderSearch() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <AdminGlobalSearch />
    </QueryClientProvider>
  );
  return screen.getByRole("combobox", { name: "Search admin" });
}

async function advance(ms = 350) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function settle(callback: () => void) {
  await act(async () => {
    callback();
  });
  await advance(1);
}

describe("AdminGlobalSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.push.mockReset();
    mocks.search.mockReset().mockResolvedValue({ results: [], unavailable: [] });
    mocks.admin.permissions = [P.OrdersRead];
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    clients.splice(0).forEach((client) => client.clear());
    vi.useRealTimers();
  });

  it("shows only permitted admin pages before any record request", () => {
    const input = renderSearch();
    fireEvent.focus(input);
    expect(
      screen.getAllByRole("option").map((option) => option.getAttribute("href"))
    ).toEqual(getAdminSearchPages("", [P.OrdersRead]).map((page) => page.href));
    expect(
      screen.queryByRole("option", { name: /Admin users|Customer list|Create product/ })
    ).not.toBeInTheDocument();
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("debounces the latest term, requires two characters and supplies permissions and cancellation", async () => {
    const input = renderSearch();
    fireEvent.change(input, { target: { value: "o" } });
    await advance();
    expect(mocks.search).not.toHaveBeenCalled();
    expect(
      screen.getByText("Type at least 2 characters to search records.")
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "or" } });
    await advance(349);
    expect(mocks.search).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  order  " } });
    await advance(349);
    expect(mocks.search).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.search).toHaveBeenCalledTimes(1);
    expect(mocks.search).toHaveBeenCalledWith(
      mocks.api,
      "order",
      [P.OrdersRead],
      expect.any(AbortSignal)
    );
  });

  it("supports the focus shortcut, arrow selection, Enter navigation and Escape dismissal", () => {
    const input = renderSearch();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith(options[0]?.getAttribute("href"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it("keeps matching pages usable during loading and clears resolved record results immediately", async () => {
    const response = deferred<SearchResponse>();
    mocks.search.mockReturnValue(response.promise);
    const input = renderSearch();
    fireEvent.change(input, { target: { value: "order" } });
    expect(screen.getByLabelText("Searching")).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    await advance();
    await settle(() =>
      response.resolve({ results: [record("Order SMP-101")], unavailable: [] })
    );
    expect(screen.getByRole("option", { name: /Order SMP-101/ })).toHaveAttribute(
      "href",
      "/orders/Order%20SMP-101"
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(
      screen.queryByRole("option", { name: /Order SMP-101/ })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Jump to a page")).toBeInTheDocument();
  });

  it("does not expose an older query response while a new query is debouncing or loading", async () => {
    const oldResponse = deferred<SearchResponse>();
    const currentResponse = deferred<SearchResponse>();
    mocks.search
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(currentResponse.promise);
    const input = renderSearch();
    fireEvent.change(input, { target: { value: "alpha" } });
    await advance();
    fireEvent.change(input, { target: { value: "beta" } });
    await settle(() =>
      oldResponse.resolve({
        results: [record("alpha old result")],
        unavailable: ["Old source failure"]
      })
    );
    expect(screen.queryByText("alpha old result")).not.toBeInTheDocument();
    expect(screen.queryByText(/Old source failure/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Searching")).toBeInTheDocument();
    await advance();
    expect(screen.queryByText("alpha old result")).not.toBeInTheDocument();
    await settle(() =>
      currentResponse.resolve({
        results: [record("beta current result")],
        unavailable: []
      })
    );
    expect(screen.getByText("beta current result")).toBeInTheDocument();
    expect(screen.queryByLabelText("Searching")).not.toBeInTheDocument();
  });

  it("preserves successful records on a partial failure and retries the current query", async () => {
    mocks.search.mockResolvedValueOnce({
      results: [record("SMP-101")],
      unavailable: ["Products"]
    });
    mocks.search.mockResolvedValueOnce({
      results: [record("SMP-101"), record("SMP-102")],
      unavailable: []
    });
    const input = renderSearch();
    fireEvent.change(input, { target: { value: "SMP" } });
    await advance();
    await advance(1);
    expect(screen.getByText("SMP-101")).toBeInTheDocument();
    expect(screen.getByText(/Could not search: Products/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await advance(1);
    expect(mocks.search).toHaveBeenCalledTimes(2);
    expect(screen.getByText("SMP-102")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("does not carry an old query error or retry action into the next query", async () => {
    mocks.search.mockRejectedValueOnce(new Error("Offline"));
    const input = renderSearch();
    fireEvent.change(input, { target: { value: "alpha" } });
    await advance();
    await advance(1);
    expect(screen.getByText("Record search is unavailable.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "beta" } });
    expect(screen.getByLabelText("Searching")).toBeInTheDocument();
    expect(screen.queryByText("Record search is unavailable.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
