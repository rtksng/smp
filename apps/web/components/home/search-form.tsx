"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { z } from "zod";
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const search = submitSearch();
      const params = new URLSearchParams();

      if (search) {
        params.set("q", search);
      }

      setError(undefined);
      router.push(params.toString() ? `/products?${params.toString()}` : "/products");
    } catch (issue) {
      if (issue instanceof z.ZodError) {
        setError(issue.issues[0]?.message ?? "Search is invalid.");
      } else {
        setError("Search is invalid.");
      }
    }
  }

  return (
    <div className="grid gap-3">
      <form
        className={compact ? "grid gap-2 sm:grid-cols-[1fr_auto]" : "grid gap-3 sm:grid-cols-[1fr_auto]"}
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
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#31413d]">
          <span className="text-[#687773]">Quick search</span>
          {suggestions.map((suggestion) => (
            <a
              className="rounded-full border border-[#d8e2df] bg-white px-3 py-1.5 text-[#084c61] transition hover:border-[#006d77] hover:bg-[#e7f3f2]"
              href={`/products?${new URLSearchParams({ q: suggestion }).toString()}`}
              key={suggestion}
            >
              {suggestion}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
