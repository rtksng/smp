"use client";

import { useMemo, useState } from "react";

export const CLIENT_PAGE_SIZE = 20;

/**
 * Pages an in-memory list for endpoints that return every row at once.
 * Changing `resetKey` (for example the search text) returns to page 1, and the page is clamped
 * when the list shrinks so a delete on the last page never leaves an empty view.
 */
export function useClientPagination<T>(
  items: readonly T[],
  resetKey = "",
  pageSize = CLIENT_PAGE_SIZE
) {
  const [state, setState] = useState({ page: 1, resetKey });
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(state.resetKey === resetKey ? state.page : 1, totalPages);
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    pageItems,
    pageSize,
    setPage: (nextPage: number) => setState({ page: nextPage, resetKey }),
    totalItems: items.length,
    totalPages
  };
}
