"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getProducts } from "../../lib/api/products";
import { useCatalogStore } from "../../lib/stores/catalog-store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SearchFormProps = {
  compact?: boolean;
  id: string;
  placeholder?: string;
  suggestions?: string[];
};

export function SearchForm({
  compact = false,
  id,
  placeholder = "Search products, SKU, or brand",
  suggestions = []
}: SearchFormProps) {
  const router = useRouter();
  const searchInput = useCatalogStore((state) => state.searchInput);
  const setSearchInput = useCatalogStore((state) => state.setSearchInput);
  const submitSearch = useCatalogStore((state) => state.submitSearch);
  const [error, setError] = useState<string | undefined>();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const trimmedSearchInput = searchInput.trim();
  const autocompleteQuery = useQuery({
    enabled: trimmedSearchInput.length >= 2,
    queryFn: () =>
      getProducts({
        limit: 5,
        search: trimmedSearchInput
      }),
    queryKey: ["search-autocomplete", trimmedSearchInput],
    staleTime: 30_000
  });
  const dynamicSuggestions = useMemo(
    () =>
      uniqueSuggestions([
        ...(autocompleteQuery.data?.items.flatMap((product) => [
          product.name,
          product.sku
        ]) ?? []),
        ...recentSearches,
        ...suggestions
      ]).slice(0, compact ? 5 : 8),
    [autocompleteQuery.data?.items, compact, recentSearches, suggestions]
  );

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const search = submitSearch();
      const params = new URLSearchParams();

      if (search) {
        params.set("q", search);
      }

      setError(undefined);
      rememberSearch(search);
      router.push(params.toString() ? `/products?${params.toString()}` : "/products");
    } catch (issue) {
      if (issue instanceof z.ZodError) {
        setError(issue.issues[0]?.message ?? "Search is invalid.");
      } else {
        setError("Search is invalid.");
      }
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setSearchInput(suggestion);
    rememberSearch(suggestion);
  }

  return (
    <div className="grid gap-3">
      <form
        className={
          compact
            ? "grid gap-2 sm:grid-cols-[1fr_auto]"
            : "grid gap-3 sm:grid-cols-[1fr_auto]"
        }
        onSubmit={handleSubmit}
      >
        <Input
          aria-label="Search products, SKU, or brand"
          error={error}
          icon={<Search aria-hidden="true" className="h-5 w-5" />}
          id={id}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={placeholder}
          value={searchInput}
        />
        <Button
          aria-label={compact ? "Search catalog" : undefined}
          className={compact ? "min-h-12 px-4" : "min-h-12 px-6"}
          type="submit"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          <span className={compact ? "sr-only" : ""}>Search</span>
        </Button>
      </form>
      {dynamicSuggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#12314f]">
          {dynamicSuggestions.map((suggestion) => (
            <a
              className="rounded-full border border-[#d6e7f8] bg-white px-3 py-1.5 text-[#0b5cab] transition hover:border-[#0b5cab] hover:bg-[#edf6ff]"
              href={`/products?${new URLSearchParams({ q: suggestion }).toString()}`}
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function uniqueSuggestions(values: string[]) {
  const seen = new Set<string>();

  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase();
      const keep = value.length > 0 && !seen.has(key);

      if (keep) {
        seen.add(key);
      }

      return keep;
    });
}

function readRecentSearches() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem("surgical.customer.recent-searches") ?? "[]"
    );

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function rememberSearch(value: string) {
  if (typeof window === "undefined" || value.length === 0) {
    return;
  }

  const searches = uniqueSuggestions([value, ...readRecentSearches()]).slice(0, 5);

  window.localStorage.setItem(
    "surgical.customer.recent-searches",
    JSON.stringify(searches)
  );
}
