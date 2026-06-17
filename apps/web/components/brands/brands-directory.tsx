"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { Brand, ProductList } from "../../lib/api/schemas";
import {
  filterBrandsForDirectory,
  type BrandLogoFilter
} from "../../lib/catalog/storefront";
import { formatRupees } from "../../lib/catalog/product-pricing";
import { getBrandImageAlt } from "../../lib/seo/metadata";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";

type BrandsDirectoryProps = {
  brandProducts: Record<string, ProductList | undefined>;
  brands: Brand[];
};

export function BrandsDirectory({ brandProducts, brands }: BrandsDirectoryProps) {
  const [query, setQuery] = useState("");
  const [logoFilter, setLogoFilter] = useState<BrandLogoFilter>("all");
  const filteredBrands = useMemo(
    () =>
      filterBrandsForDirectory(brands, {
        logo: logoFilter,
        query
      }),
    [brands, logoFilter, query]
  );

  return (
    <div className="grid gap-7">
      <div className="grid gap-3 rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
        <label className="grid gap-2 text-sm font-bold text-[#12314f]">
          <span>Search brands</span>
          <span className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0b5cab]"
            />
            <input
              aria-label="Search brands"
              className="min-h-11 w-full rounded-lg border border-[#cfdcda] bg-white px-4 pl-10 text-sm font-semibold text-[#17211f] outline-none transition focus:border-[#006d77] focus:ring-2 focus:ring-[#006d77]/20"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by brand, use case, or slug"
              type="search"
              value={query}
            />
          </span>
        </label>

        <label className="grid gap-2 text-sm font-bold text-[#12314f]">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-[#0b5cab]" />
            Filter
          </span>
          <select
            aria-label="Brand logo filter"
            className="min-h-11 rounded-lg border border-[#cfdcda] bg-white px-3 text-sm font-semibold text-[#17211f] outline-none transition focus:border-[#006d77] focus:ring-2 focus:ring-[#006d77]/20"
            onChange={(event) => setLogoFilter(event.target.value as BrandLogoFilter)}
            value={logoFilter}
          >
            <option value="all">All brands</option>
            <option value="with-logo">With logos</option>
            <option value="without-logo">Without logos</option>
          </select>
        </label>
      </div>

      {filteredBrands.length === 0 ? (
        <EmptyState
          description="No brands match the current filters."
          title="No brands found"
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredBrands.map((brand) => (
            <article
              className="grid gap-5 rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#0b5cab] hover:shadow-lg hover:shadow-[#0b5cab]/10"
              key={brand.id}
            >
              <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                <a
                  className="flex min-h-28 items-center justify-center rounded-lg border border-[#d6e7f8] bg-[#f4f9ff] p-4"
                  href={`/brands/${brand.slug}`}
                >
                  {brand.logoUrl ? (
                    <Image
                      alt={getBrandImageAlt(brand.name)}
                      className="h-16 w-auto max-w-full object-contain"
                      height={220}
                      sizes="160px"
                      src={brand.logoUrl}
                      unoptimized={brand.logoUrl.startsWith("http://localhost")}
                      width={420}
                    />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl font-bold text-[#0b5cab] shadow-sm shadow-[#0b5cab]/10">
                      {brand.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </a>

                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-7 text-[#12314f]">
                    {brand.name}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#52677f]">
                    {brand.description ??
                      "Browse verified surgical and medical products from this brand."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      aria-label={`Open ${brand.name} products`}
                      href={`/brands/${brand.slug}`}
                    >
                      Open products
                    </Button>
                    <Button href={`/products?brand=${brand.slug}`} variant="outline">
                      Filter catalog
                    </Button>
                  </div>
                </div>
              </div>

              <BrandProductPreview products={brandProducts[brand.slug]} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandProductPreview({ products }: { products?: ProductList }) {
  if (!products) {
    return (
      <p className="rounded-lg border border-dashed border-[#d6e7f8] bg-[#f4f9ff] px-4 py-3 text-sm font-semibold text-[#52677f]">
        Product preview is unavailable right now.
      </p>
    );
  }

  if (products.items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#d6e7f8] bg-[#f4f9ff] px-4 py-3 text-sm font-semibold text-[#52677f]">
        No active products are listed for this brand yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3 border-t border-[#d6e7f8] pt-4">
      <h3 className="text-sm font-bold uppercase text-[#0b5cab]">
        Latest brand products
      </h3>
      <div className="grid gap-2">
        {products.items.slice(0, 4).map((product) => (
          <a
            className="grid gap-1 rounded-lg border border-[#d6e7f8] bg-[#f8fbff] px-4 py-3 transition hover:border-[#0b5cab] hover:bg-[#edf6ff]"
            href={`/products/${product.slug}`}
            key={product.id}
          >
            <h4 className="line-clamp-1 text-sm font-bold text-[#12314f]">
              {product.name}
            </h4>
            <span className="text-xs font-semibold text-[#52677f]">
              {product.category.name} - {formatRupees(product.sellingPrice)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
