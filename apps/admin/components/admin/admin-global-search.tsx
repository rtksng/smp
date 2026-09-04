"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, LoaderCircle, Search, X } from "lucide-react";
import { useAdminSession } from "@/lib/admin-session";
import { getAdminSearchPages, searchAdmin } from "@/lib/admin-global-search";
import styles from "./admin-topbar.module.css";

export function AdminGlobalSearch() {
  const { admin, api } = useAdminSession();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const listId = useId();
  const permissions = admin?.permissions ?? [];
  const term = input.trim();
  const resultsQuery = useQuery({
    queryKey: ["admin", "global-search", admin?.id, permissions, query],
    queryFn: ({ signal }) => searchAdmin(api, query, permissions, signal),
    enabled: Boolean(admin && open && query.length >= 2),
    staleTime: 30_000,
    gcTime: 60_000,
    retry: false
  });
  const pages = getAdminSearchPages(term, permissions);
  const data = query === term ? resultsQuery.data : undefined;
  const currentError = query === term && term.length >= 2 && resultsQuery.isError;
  // Navigation stays available while the live record search is loading.
  const results = data?.results ?? pages;
  const loading = term.length >= 2 && (query !== term || resultsQuery.isFetching);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(term), 350);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        field.current?.focus();
        setOpen(true);
      }
    }
    function onOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, []);

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const next =
        event.key === "ArrowDown"
          ? Math.min(active + 1, results.length - 1)
          : Math.max(active - 1, 0);
      setActive(next);
      document
        .getElementById(`${listId}-${next}`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && open && results.length) {
      event.preventDefault();
      const selected = results[Math.max(0, Math.min(active, results.length - 1))];
      if (!selected) return;
      router.push(selected.href);
      setOpen(false);
      field.current?.blur();
    }
  }

  return (
    <div
      className={styles.searchRoot}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className={styles.searchField}>
        <Search size={18} aria-hidden="true" />
        <input
          ref={field}
          type="search"
          role="combobox"
          aria-label="Search admin"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 && active < results.length
              ? `${listId}-${active}`
              : undefined
          }
          placeholder="Search anything in admin…"
          autoComplete="off"
          maxLength={100}
          value={input}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setInput(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={handleKey}
        />
        {input ? (
          <button
            type="button"
            className={styles.clearSearch}
            aria-label="Clear search"
            onClick={() => {
              setInput("");
              setActive(-1);
              field.current?.focus();
            }}
          >
            <X size={15} />
          </button>
        ) : (
          <kbd className={styles.shortcut}>Ctrl K</kbd>
        )}
      </div>
      {open ? (
        <div className={styles.searchPanel}>
          <div className={styles.searchCaption}>
            <span>{term ? "Search results" : "Jump to a page"}</span>
            {loading ? (
              <LoaderCircle
                className={styles.spinner}
                size={15}
                aria-label="Searching"
              />
            ) : (
              <span>{results.length} results</span>
            )}
          </div>
          {term.length === 1 ? (
            <p className={styles.searchHint}>
              Type at least 2 characters to search records.
            </p>
          ) : null}
          <div
            role="listbox"
            aria-label="Admin search results"
            id={listId}
            className={styles.results}
          >
            {results.map((result, index) => (
              <Link
                id={`${listId}-${index}`}
                role="option"
                aria-selected={active === index}
                className={styles.result}
                href={result.href}
                key={result.id}
                onClick={() => {
                  setOpen(false);
                  setInput("");
                }}
              >
                <span className={styles.resultIcon}>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
                <span className={styles.resultText}>
                  <strong>{result.title}</strong>
                  <small>{result.description}</small>
                </span>
                <span className={styles.resultGroup}>{result.group}</span>
              </Link>
            ))}
          </div>
          {!results.length && !loading ? (
            <p className={styles.searchHint}>
              {currentError
                ? "Search is unavailable. Try again."
                : `No matches for “${term}”. Try a name, order number, phone or SKU.`}
            </p>
          ) : null}
          {data?.unavailable.length || currentError ? (
            <div className={styles.searchWarning}>
              <span>
                {data?.unavailable.length
                  ? `Could not search: ${data.unavailable.join(", ")}`
                  : "Record search is unavailable."}
              </span>
              <button type="button" onClick={() => void resultsQuery.refetch()}>
                Retry
              </button>
            </div>
          ) : null}
          {data?.limitations?.length ? (
            <p className={styles.searchHint}>{data.limitations.join(" ")}</p>
          ) : null}
          <div className={styles.searchFooter}>
            Pages and matching records you have access to{" "}
            <span>↑ ↓ to move · Enter to open</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
