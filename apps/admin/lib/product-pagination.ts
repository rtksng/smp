import type { ProductListResponse } from "./product-form";

export const PRODUCT_PAGE_SIZE_OPTIONS = [10, 50, 100, 500] as const;
export const DEFAULT_PRODUCT_PAGE_SIZE = PRODUCT_PAGE_SIZE_OPTIONS[0];
export const PRODUCT_PAGE_STALE_TIME = 30_000;
export const PRODUCT_SERVER_PAGE_SIZE = 100;
export const PRODUCT_TABLE_ROW_HEIGHT = 72;
export const PRODUCT_TABLE_VIEWPORT_HEIGHT = 620;
export const PRODUCT_VIRTUALIZATION_THRESHOLD = 50;

export type ProductPageSize = (typeof PRODUCT_PAGE_SIZE_OPTIONS)[number];

export function isProductPageSize(value: number): value is ProductPageSize {
  return PRODUCT_PAGE_SIZE_OPTIONS.some((option) => option === value);
}

type ProductQuery = Record<string, boolean | number | string | undefined>;

type ProductPageRequest = (
  query: ProductQuery,
  signal?: AbortSignal
) => Promise<ProductListResponse>;

export async function loadProductPage({
  page,
  pageSize,
  query,
  request,
  signal
}: {
  page: number;
  pageSize: ProductPageSize;
  query: ProductQuery;
  request: ProductPageRequest;
  signal?: AbortSignal;
}): Promise<ProductListResponse> {
  const firstItemOffset = (page - 1) * pageSize;
  const firstServerPage = Math.floor(firstItemOffset / PRODUCT_SERVER_PAGE_SIZE) + 1;
  const firstItemOffsetWithinServerPage = firstItemOffset % PRODUCT_SERVER_PAGE_SIZE;
  const requestedServerPageCount = Math.ceil(
    (firstItemOffsetWithinServerPage + pageSize) / PRODUCT_SERVER_PAGE_SIZE
  );
  const firstResponse = await request(
    { ...query, limit: PRODUCT_SERVER_PAGE_SIZE, page: firstServerPage },
    signal
  );
  const lastServerPage = Math.min(
    firstResponse.pagination.totalPages,
    firstServerPage + requestedServerPageCount - 1
  );
  const remainingPages = Array.from(
    { length: Math.max(lastServerPage - firstServerPage, 0) },
    (_, index) => firstServerPage + index + 1
  );
  const remainingResponses = await Promise.all(
    remainingPages.map((serverPage) =>
      request({ ...query, limit: PRODUCT_SERVER_PAGE_SIZE, page: serverPage }, signal)
    )
  );
  const total = firstResponse.pagination.total;
  const totalPages = Math.ceil(total / pageSize);
  const items = [firstResponse, ...remainingResponses]
    .flatMap((response) => response.items)
    .slice(firstItemOffsetWithinServerPage, firstItemOffsetWithinServerPage + pageSize);

  return {
    items,
    pagination: {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit: pageSize,
      page,
      total,
      totalPages
    }
  } satisfies ProductListResponse;
}

export function getProductPrefetchServerPages({
  page,
  pageSize,
  total
}: {
  page: number;
  pageSize: ProductPageSize;
  total: number;
}) {
  const firstItemOffset = (page - 1) * pageSize;
  const blockStartOffset = Math.floor(firstItemOffset / 500) * 500;
  const firstServerPage = Math.floor(blockStartOffset / PRODUCT_SERVER_PAGE_SIZE) + 1;
  const finalServerPage = Math.min(
    Math.ceil(total / PRODUCT_SERVER_PAGE_SIZE),
    firstServerPage + 4
  );

  return Array.from(
    { length: Math.max(finalServerPage - firstServerPage + 1, 0) },
    (_, index) => firstServerPage + index
  );
}

export function getProductVirtualWindow({
  itemCount,
  scrollTop,
  overscan = 8,
  rowHeight = PRODUCT_TABLE_ROW_HEIGHT,
  viewportHeight = PRODUCT_TABLE_VIEWPORT_HEIGHT
}: {
  itemCount: number;
  overscan?: number;
  rowHeight?: number;
  scrollTop: number;
  viewportHeight?: number;
}) {
  if (itemCount <= PRODUCT_VIRTUALIZATION_THRESHOLD) {
    return {
      bottomSpacerHeight: 0,
      end: itemCount,
      isVirtualized: false,
      start: 0,
      topSpacerHeight: 0
    };
  }

  const firstVisibleRow = Math.floor(Math.max(scrollTop, 0) / rowHeight);
  const visibleRowCount = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(firstVisibleRow - overscan, 0);
  const end = Math.min(firstVisibleRow + visibleRowCount + overscan, itemCount);

  return {
    bottomSpacerHeight: Math.max(itemCount - end, 0) * rowHeight,
    end,
    isVirtualized: true,
    start,
    topSpacerHeight: start * rowHeight
  };
}
