export const MAX_BULK_SELECTION = 500;

export type BulkResult<T> = {
  item: T;
  status: "succeeded" | "skipped" | "failed";
  message: string;
  value?: unknown;
};

export class BulkSkip extends Error {}

/** Freeze explicit IDs before mutations; never process a moving filtered query. */
export async function loadBulkRows<T extends { id: string }>(
  loadPage: (
    page: number,
    limit: number
  ) => Promise<{
    items: T[];
    pagination: { total: number; totalPages: number };
  }>
): Promise<T[]> {
  const first = await loadPage(1, 100);
  if (first.pagination.total > MAX_BULK_SELECTION) {
    throw new Error(
      `Select up to ${MAX_BULK_SELECTION} records at a time. Narrow your filters first.`
    );
  }
  const rows = new Map(first.items.map((item) => [item.id, item]));
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const next = await loadPage(page, 100);
    if (next.pagination.total !== first.pagination.total) {
      throw new Error("Results changed while selecting. Refresh and select again.");
    }
    next.items.forEach((item) => rows.set(item.id, item));
  }
  if (rows.size !== first.pagination.total) {
    throw new Error("Results changed while selecting. Refresh and select again.");
  }
  return [...rows.values()];
}

/** Sequential requests keep existing validation, audit logs and rate limits intact. */
export async function processBulkRows<T>(
  rows: readonly T[],
  action: {
    skipReason: (item: T) => string | null;
    execute: (item: T) => Promise<unknown>;
  },
  onProgress: (results: BulkResult<T>[]) => void = () => undefined,
  shouldStop: () => boolean = () => false
): Promise<BulkResult<T>[]> {
  const results: BulkResult<T>[] = [];
  for (const item of rows) {
    try {
      const reason = shouldStop()
        ? "Stopped before processing."
        : action.skipReason(item);
      if (reason) throw new BulkSkip(reason);
      const value = await action.execute(item);
      results.push({ item, status: "succeeded", message: "Completed", value });
    } catch (error) {
      results.push({
        item,
        status: error instanceof BulkSkip ? "skipped" : "failed",
        message:
          error instanceof Error ? error.message : "Unable to process this record."
      });
    }
    onProgress([...results]);
  }
  return results;
}
