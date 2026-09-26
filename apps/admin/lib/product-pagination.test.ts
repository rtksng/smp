import { describe, expect, it, vi } from "vitest";
import type { ProductListResponse } from "./product-form";
import {
  getProductPrefetchServerPages,
  getProductVirtualWindow,
  loadProductPage,
  PRODUCT_TABLE_ROW_HEIGHT
} from "./product-pagination";

function createResponse(page: number, limit: number, total: number) {
  const start = (page - 1) * limit;
  const count = Math.max(Math.min(limit, total - start), 0);

  return {
    items: Array.from({ length: count }, (_, index) => ({
      id: `product-${start + index + 1}`
    })) as ProductListResponse["items"],
    pagination: {
      hasNextPage: start + count < total,
      hasPreviousPage: page > 1,
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit)
    }
  } satisfies ProductListResponse;
}

describe("product pagination", () => {
  it.each([10, 50, 100] as const)(
    "loads a %s-product page from one reusable server page",
    async (pageSize) => {
      const request = vi.fn(async (query: Record<string, unknown>) =>
        createResponse(Number(query.page), Number(query.limit), 840)
      );

      const response = await loadProductPage({
        page: 2,
        pageSize,
        query: { search: "forceps" },
        request
      });

      expect(request).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledWith(
        {
          limit: 100,
          page: pageSize === 100 ? 2 : 1,
          search: "forceps"
        },
        undefined
      );
      expect(response.items).toHaveLength(pageSize);
      expect(response.items[0]?.id).toBe(`product-${pageSize + 1}`);
    }
  );

  it("combines cancellable 100-product requests into one 500-product page", async () => {
    const signal = new AbortController().signal;
    const request = vi.fn(
      async (query: Record<string, unknown>, _signal?: AbortSignal) =>
        createResponse(Number(query.page), Number(query.limit), 840)
    );

    const response = await loadProductPage({
      page: 1,
      pageSize: 500,
      query: { status: "ACTIVE" },
      request,
      signal
    });

    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 3, 4, 5]);
    expect(
      request.mock.calls.every(([, requestSignal]) => requestSignal === signal)
    ).toBe(true);
    expect(response.items).toHaveLength(500);
    expect(response.pagination).toMatchObject({
      limit: 500,
      page: 1,
      total: 840,
      totalPages: 2
    });
  });

  it("loads only the available server pages for the final 500-product page", async () => {
    const request = vi.fn(async (query: Record<string, unknown>) =>
      createResponse(Number(query.page), Number(query.limit), 840)
    );

    const response = await loadProductPage({
      page: 2,
      pageSize: 500,
      query: {},
      request
    });

    expect(request.mock.calls.map(([query]) => query.page)).toEqual([6, 7, 8, 9]);
    expect(response.items).toHaveLength(340);
    expect(response.pagination.hasNextPage).toBe(false);
  });

  it("limits large pages to the visible rows plus a small overscan buffer", () => {
    const window = getProductVirtualWindow({
      itemCount: 500,
      scrollTop: PRODUCT_TABLE_ROW_HEIGHT * 200
    });

    expect(window.isVirtualized).toBe(true);
    expect(window.start).toBe(192);
    expect(window.end - window.start).toBeLessThanOrEqual(25);
    expect(window.topSpacerHeight).toBe(192 * PRODUCT_TABLE_ROW_HEIGHT);
    expect(window.bottomSpacerHeight).toBeGreaterThan(0);
  });

  it("renders small product pages without spacer rows", () => {
    expect(getProductVirtualWindow({ itemCount: 50, scrollTop: 900 })).toEqual({
      bottomSpacerHeight: 0,
      end: 50,
      isVirtualized: false,
      start: 0,
      topSpacerHeight: 0
    });
  });

  it("prefetches only the reusable 500-product block around the current page", () => {
    expect(
      getProductPrefetchServerPages({ page: 1, pageSize: 10, total: 840 })
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      getProductPrefetchServerPages({ page: 51, pageSize: 10, total: 840 })
    ).toEqual([6, 7, 8, 9]);
    expect(getProductPrefetchServerPages({ page: 1, pageSize: 10, total: 0 })).toEqual(
      []
    );
  });
});
