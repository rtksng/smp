"use client";

import { useRef, useState } from "react";
import { MAX_BULK_SELECTION } from "./bulk-actions";

export function useBulkSelection<T extends { id: string }>(
  scope: string,
  pageRows: T[]
) {
  const [state, setState] = useState<{ scope: string; items: T[] }>({
    scope,
    items: []
  });
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const stored = state.scope === scope ? state.items : [];
  if (state.scope !== scope) setState({ scope, items: [] });
  const freshRows = new Map(pageRows.map((item) => [item.id, item]));
  const selected = stored.map((item) => freshRows.get(item.id) ?? item);
  const ids = new Set(selected.map((item) => item.id));

  function replace(items: T[]) {
    if (currentScope.current !== scope) return;
    setState({
      scope,
      items: [...new Map(items.map((item) => [item.id, item])).values()].slice(
        0,
        MAX_BULK_SELECTION
      )
    });
  }

  return {
    scope,
    selected,
    ids,
    isBusy,
    replace,
    setBusy(value: boolean) {
      busyRef.current = value;
      setIsBusy(value);
    },
    clear() {
      if (!busyRef.current) replace([]);
    },
    toggle(item: T, checked: boolean) {
      if (busyRef.current) return;
      setState((previous) => {
        const items = previous.scope === scope ? previous.items : [];
        const next = new Map(items.map((row) => [row.id, row]));
        if (checked && next.size < MAX_BULK_SELECTION) next.set(item.id, item);
        if (!checked) next.delete(item.id);
        return { scope, items: [...next.values()] };
      });
    },
    togglePage(checked: boolean) {
      if (busyRef.current) return;
      const next = new Map(selected.map((item) => [item.id, item]));
      pageRows.forEach((item) => {
        if (checked && next.size < MAX_BULK_SELECTION) next.set(item.id, item);
        if (!checked) next.delete(item.id);
      });
      replace([...next.values()]);
    },
    pageChecked: pageRows.length > 0 && pageRows.every((item) => ids.has(item.id)),
    pageMixed:
      pageRows.some((item) => ids.has(item.id)) &&
      !pageRows.every((item) => ids.has(item.id))
  };
}

export type BulkSelection<T extends { id: string }> = ReturnType<
  typeof useBulkSelection<T>
>;
