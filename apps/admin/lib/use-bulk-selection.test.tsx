import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBulkSelection } from "./use-bulk-selection";

describe("bulk selection scope", () => {
  it("retains selection across pages, shows mixed state, and never restores old filter selections", () => {
    const { result, rerender } = renderHook(
      ({ scope, rows }) => useBulkSelection(scope, rows),
      {
        initialProps: {
          scope: "all",
          rows: [
            { id: "1", status: "old" },
            { id: "2", status: "old" }
          ]
        }
      }
    );
    act(() => result.current.toggle({ id: "1", status: "old" }, true));
    expect(result.current.pageMixed).toBe(true);
    rerender({ scope: "all", rows: [{ id: "3", status: "old" }] });
    act(() => result.current.togglePage(true));
    expect([...result.current.ids]).toEqual(["1", "3"]);
    rerender({ scope: "all", rows: [{ id: "1", status: "fresh" }] });
    expect(result.current.selected[0]!.status).toBe("fresh");
    rerender({ scope: "filtered", rows: [{ id: "1", status: "fresh" }] });
    expect(result.current.selected).toEqual([]);
    rerender({ scope: "all", rows: [{ id: "1", status: "fresh" }] });
    expect(result.current.selected).toEqual([]);
  });

  it("locks selection while processing and caps selection at 500", () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i) }));
    const { result } = renderHook(() => useBulkSelection("all", rows));
    act(() => result.current.togglePage(true));
    expect(result.current.selected).toHaveLength(500);
    act(() => result.current.setBusy(true));
    act(() => result.current.clear());
    act(() => result.current.togglePage(false));
    expect(result.current.selected).toHaveLength(500);
  });
});
