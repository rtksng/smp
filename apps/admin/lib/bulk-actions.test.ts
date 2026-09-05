import { describe, expect, it, vi } from "vitest";
import { BulkSkip, loadBulkRows, processBulkRows } from "./bulk-actions";

describe("bulk processing", () => {
  it("processes eligible rows once and isolates skipped, failed, and stale records", async () => {
    const execute = vi.fn(async (id: number) => {
      if (id === 2) throw new Error("Warehouse access denied");
      if (id === 3) throw new BulkSkip("Already assigned");
      return id;
    });
    const progress = vi.fn();
    const results = await processBulkRows(
      [0, 1, 2, 3, 4],
      { skipReason: (id) => (id === 0 ? "Ineligible" : null), execute },
      progress
    );
    expect(results.map((row) => row.status)).toEqual([
      "skipped",
      "succeeded",
      "failed",
      "skipped",
      "succeeded"
    ]);
    expect(execute.mock.calls.flat()).toEqual([1, 2, 3, 4]);
    expect(progress).toHaveBeenCalledTimes(5);
  });

  it("stops unstarted requests while preserving the completed record", async () => {
    let stopped = false;
    const execute = vi.fn(async () => {
      stopped = true;
    });
    const results = await processBulkRows(
      [1, 2, 3],
      { skipReason: () => null, execute },
      () => undefined,
      () => stopped
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(results.map((row) => row.status)).toEqual([
      "succeeded",
      "skipped",
      "skipped"
    ]);
  });

  it("loads every page before selecting explicit record IDs", async () => {
    const load = vi.fn(async (page: number) => ({
      items: [{ id: String(page) }],
      pagination: { total: 3, totalPages: 3 }
    }));
    expect(await loadBulkRows(load)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(load).toHaveBeenLastCalledWith(3, 100);
  });

  it("rejects oversized selections without loading more pages", async () => {
    const load = vi.fn(async () => ({
      items: [],
      pagination: { total: 501, totalPages: 6 }
    }));
    await expect(loadBulkRows(load)).rejects.toThrow("Narrow your filters");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("rejects a moving result set instead of silently selecting an incomplete batch", async () => {
    const load = vi.fn(async (page: number) => ({
      items: [{ id: "same" }],
      pagination: { total: page === 1 ? 2 : 3, totalPages: 2 }
    }));
    await expect(loadBulkRows(load)).rejects.toThrow("Results changed");
    await expect(
      loadBulkRows(async () => ({
        items: [{ id: "same" }],
        pagination: { total: 2, totalPages: 2 }
      }))
    ).rejects.toThrow("Results changed");
  });
});
