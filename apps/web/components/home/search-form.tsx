"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FocusEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getProducts } from "../../lib/api/products";
import { productSearchSchema, useCatalogStore } from "../../lib/stores/catalog-store";
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
  const [error, setError] = useState<string | undefined>();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const trimmedSearchInput = query.trim();
  const isTyping = trimmedSearchInput.length > 0;
  const suggestionLimit = compact ? 5 : 8;
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
  const typedSuggestions = useMemo(
    () => {
      const staticMatches = suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(trimmedSearchInput.toLowerCase())
      );

      return uniqueSuggestions([
        ...(autocompleteQuery.data?.items.flatMap((product) => [
          product.name,
          product.sku
        ]) ?? []),
        ...staticMatches
      ]).slice(0, suggestionLimit);
    },
    [
      autocompleteQuery.data?.items,
      suggestionLimit,
      suggestions,
      trimmedSearchInput
    ]
  );
  const idleSuggestions = useMemo(
    () => uniqueSuggestions([...recentSearches, ...suggestions]).slice(0, suggestionLimit),
    [recentSearches, suggestionLimit, suggestions]
  );
  const visibleSuggestions = isTyping ? typedSuggestions : idleSuggestions;
  const shouldShowSuggestions = isSearchActive && visibleSuggestions.length > 0;

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const search = productSearchSchema.parse(query);
      const params = new URLSearchParams();

      if (search) {
        params.set("q", search);
      }

      setError(undefined);
      recordSubmittedSearch(search);
      rememberSearch(search);
      setRecentSearches(readRecentSearches());
      setQuery("");
      setIsSearchActive(false);
      router.push(params.toString() ? `/products?${params.toString()}` : "/products");
    } catch (issue) {
      if (issue instanceof z.ZodError) {
        setError(issue.issues[0]?.message ?? "Search is invalid.");
      } else {
        setError("Search is invalid.");
      }
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsSearchActive(false);
  }

  function handleSuggestionClick(suggestion: string) {
    recordSubmittedSearch(suggestion);
    rememberSearch(suggestion);
    setRecentSearches(readRecentSearches());
    setQuery("");
    setIsSearchActive(false);
  }

  return (
    <div
      className="relative grid gap-3"
      onBlur={handleBlur}
      onFocus={() => setIsSearchActive(true)}
    >
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          value={query}
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
      {shouldShowSuggestions ? (
        <div
          aria-label={isTyping ? "Search suggestions" : "Recent searches"}
          className={
            compact
              ? "absolute left-0 right-0 top-full z-50 mt-2 grid gap-1 overflow-hidden rounded-2xl border border-[#c4e4e0] bg-white p-2 text-sm font-semibold text-[#123f3c] shadow-2xl shadow-[#0f6f68]/15"
              : "flex flex-wrap items-center gap-2 text-xs font-semibold text-[#123f3c]"
          }
          data-testid="search-suggestions"
        >
          {visibleSuggestions.map((suggestion) => (
            <a
              className={
                compact
                  ? "block rounded-xl px-3 py-2 text-[#0f6f68] transition hover:bg-[#e5f5f3]"
                  : "rounded-full border border-[#c4e4e0] bg-white px-3 py-1.5 text-[#0f6f68] transition hover:border-[#0f6f68] hover:bg-[#e5f5f3]"
              }
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

function recordSubmittedSearch(value: string) {
  useCatalogStore.setState({
    searchInput: "",
    submittedSearch: value
  });
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
