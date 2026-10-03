"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether the shared table viewport inside the returned ref is wider than its visible area,
 * so swipe hints and pinned columns only appear when the table really scrolls sideways.
 */
export function useTableOverflow<TElement extends HTMLElement = HTMLDivElement>(
  isActive = true
) {
  const shellRef = useRef<TElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const viewport = shellRef.current?.querySelector<HTMLElement>(
      "[data-slot='table-container']"
    );

    if (!isActive || !viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const update = () =>
      setIsOverflowing(viewport.scrollWidth > viewport.clientWidth + 1);
    const observer = new ResizeObserver(update);

    observer.observe(viewport);
    const table = viewport.querySelector("table");
    if (table) {
      observer.observe(table);
    }
    update();

    return () => observer.disconnect();
  }, [isActive]);

  return { isOverflowing, shellRef };
}
