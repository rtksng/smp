import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClientPagination } from "./use-client-pagination";

const rows = Array.from({ length: 45 }, (_, index) => index + 1);

describe("useClientPagination", () => {
  it("slices the requested page and reports totals", () => {
    const { result } = renderHook(() => useClientPagination(rows));

    expect(result.current.pageItems).toEqual(rows.slice(0, 20));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(45);

    act(() => result.current.setPage(3));
    expect(result.current.pageItems).toEqual([41, 42, 43, 44, 45]);
  });

  it("returns to page one when the reset key changes and clamps when rows shrink", () => {
    const { rerender, result } = renderHook(
      ({ items, resetKey }) => useClientPagination(items, resetKey),
      { initialProps: { items: rows, resetKey: "" } }
    );

    act(() => result.current.setPage(3));
    rerender({ items: rows, resetKey: "surgical" });
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(3));
    rerender({ items: rows.slice(0, 25), resetKey: "surgical" });
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems).toEqual(rows.slice(20, 25));
  });
});
