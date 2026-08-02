"use client";

import {
  Award,
  BadgePercent,
  ClipboardCheck,
  Gift,
  Grid2X2,
  HeartPulse,
  Search,
  Truck
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Brand, Category, Product, ProductList } from "../../lib/api/schemas";
import {
  buildCategoryNavigation,
  type CategoryNavigationItem
} from "../../lib/catalog/customer-navigation";
import { formatRupees, getProductSavings } from "../../lib/catalog/product-pricing";
import {
  getBrandImageAlt,
  getCategoryImageAlt,
  getProductImageAlt
} from "../../lib/seo/metadata";
import { BulkQuoteForm } from "./bulk-quote-form";

type MobileCommerceHomeProps = {
  brands: Brand[];
  categories: Category[];
  featuredCategories?: CategoryNavigationItem[];
  featuredCategoryProducts?: Record<string, ProductList | undefined>;
  products: Product[];
};

const fallbackCategoryIcons = [Gift, HeartPulse, Search, Grid2X2];

const trustItems = [
  { Icon: Award, label: "Verified Products", value: "Quality checked" },
  { Icon: BadgePercent, label: "GST Ready", value: "Invoice support" },
  { Icon: Truck, label: "Delivery clarity", value: "Shown at checkout" },
  { Icon: ClipboardCheck, label: "Bulk quotes", value: "Tailored support" }
];

const mobileBannerSlides = [
  {
    alt: "Hospital supplies ordered simply banner",
    href: "/products",
    imageUrl: "/banner/mobile-banner-1.png"
  },
  {
    alt: "Diagnostics ready devices and monitors banner",
    href: "/categories/diagnostics",
    imageUrl: "/banner/mobile-banner-2.png"
  },
  {
    alt: "Dental essentials clinic supplies banner",
    href: "/categories/dental",
    imageUrl: "/banner/mobile-banner-3.png"
  },
  {
    alt: "Bulk orders procurement support banner",
    href: "/#bulk",
    imageUrl: "/banner/mobile-banner-4.png"
  },
  {
    alt: "Lab essentials reliable diagnostics banner",
    href: "/products?q=diagnostics",
    imageUrl: "/banner/mobile-banner-5.png"
  }
];

const MOBILE_BANNER_INTERVAL_MS = 4500;

const horizontalRailClassName =
  "flex max-w-full gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
const mobileSectionClassName = "pt-8";
const mobileLandingActionClassName =
  "inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-[#c7eacb] bg-white px-3 text-[11px] font-extrabold text-[#287c30]  whitespace-nowrap";
const mobileCategoryActionClassName =
  "inline-flex min-h-6 items-center justify-center rounded-full border border-[#c7eacb] bg-[#f4fbf5] px-2.5 text-[10px] font-semibold text-[#287c30]  whitespace-nowrap";

export function MobileCommerceHome({
  brands,
  categories,
  featuredCategories = [],
  featuredCategoryProducts = {},
  products
}: MobileCommerceHomeProps) {
  const categoryNavigation = buildCategoryNavigation(categories, 10);
  const brandPreview = brands.filter((brand) => brand.isActive).slice(0, 10);
  const productPreview = products.slice(0, 12);

  return (
    <div
      className="max-w-full overflow-x-hidden bg-[#f5fbf6] pb-24 md:hidden"
      data-testid="mobile-commerce-home"
    >
      <MobileBannerCarousel />

      <section className={mobileSectionClassName} id="categories">
        <MobileSectionHeader title="Shop by Category" />
        <div
          aria-label="Shop by Category"
          className={horizontalRailClassName}
          data-testid="mobile-category-rail"
        >
          {categoryNavigation.map((category, index) => (
            <MobileCategoryCard category={category} index={index} key={category.id} />
          ))}
        </div>
        <div className="px-4 pt-4">
          <Link
            className="mx-auto flex min-h-11 w-fit items-center justify-center rounded-lg border border-[#a9ddae] bg-white px-6 text-xs font-semibold text-[#287c30]"
            href="/products"
          >
            Browse all categories
          </Link>
        </div>
      </section>

      <MobileFeaturedProductsByCategory
        categories={featuredCategories}
        productsByCategory={featuredCategoryProducts}
      />

      <section className={mobileSectionClassName}>
        <MobileSectionHeader
          actionHref="/brands"
          actionText="View all brands"
          title="Top Brands"
        />
        <div
          aria-label="Top Brands"
          className={horizontalRailClassName}
          data-testid="mobile-brand-rail"
        >
          {brandPreview.map((brand) => (
            <Link
              className="grid min-h-24 w-[5.9rem] shrink-0 content-center justify-items-center gap-2 rounded-xl border border-[#cfe9d2] bg-white p-3 text-center shadow-sm shadow-[#287c30]/5"
              href={`/brands/${brand.slug}`}
              key={brand.id}
            >
              {brand.logoUrl ? (
                <Image
                  alt={getBrandImageAlt(brand.name)}
                  className="h-8 w-full object-contain"
                  height={120}
                  src={brand.logoUrl}
                  unoptimized={brand.logoUrl.startsWith("http://localhost")}
                  width={240}
                />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eaf7eb] text-sm font-black text-[#287c30]">
                  {brand.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="line-clamp-1 text-[11px] font-semibold text-[#173b1d]">
                {brand.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <MobileProductRail products={productPreview} title="Latest additions" />

      <section className={mobileSectionClassName}>
        <MobileSectionHeader title="Procurement support" />
        <div aria-label="Procurement support" className="grid grid-cols-2 gap-3 px-4">
          {trustItems.map(({ Icon, label, value }) => (
            <div
              className="grid min-h-28 content-start gap-3 rounded-xl border border-[#cfe9d2] bg-white p-3 shadow-sm shadow-[#287c30]/5"
              key={label}
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#fff3e3] text-[#d26812]">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <p>
                <span className="block text-sm font-semibold leading-5 text-[#173b1d]">
                  {label}
                </span>
                <span className="mt-1 block text-[11px] font-semibold leading-4 text-[#556b57]">
                  {value}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${mobileSectionClassName} px-4`} id="bulk">
        <div className="rounded-2xl bg-[#237b2c] p-5 text-white shadow-lg shadow-[#287c30]/15">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c7eacb]">
            Bulk procurement
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-6">
            Request a tailored quote
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Share items, quantities, and delivery details. Our team will follow up with the right options.
          </p>
          <div className="mt-5">
            <BulkQuoteForm />
          </div>
        </div>
      </section>
    </div>
  );
}

function MobileBannerCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % mobileBannerSlides.length);
    }, MOBILE_BANNER_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section
      aria-label="Mobile promotional banners"
      className="max-w-full overflow-hidden px-4 pt-4 md:hidden"
    >
      <div className="relative h-40 overflow-hidden rounded-xl border border-[#cfe9d2] bg-[#ddf3e0] ">
        {mobileBannerSlides.map((slide, index) => {
          const isActive = index === activeSlide;

          return (
            <Link
              aria-hidden={!isActive}
              className={[
                "absolute inset-0 block transition-opacity duration-500 ease-out",
                isActive ? "z-10 opacity-100" : "z-0 opacity-0"
              ].join(" ")}
              data-active={isActive}
              data-testid={`mobile-banner-slide-${index + 1}`}
              href={slide.href}
              key={slide.imageUrl}
              tabIndex={isActive ? 0 : -1}
            >
              <Image
                alt={slide.alt}
                className="h-full w-full object-cover"
                fill
                priority={index === 0}
                sizes="(max-width: 767px) calc(100vw - 2rem), 1px"
                src={slide.imageUrl}
              />
            </Link>
          );
        })}
        <div className="absolute inset-x-0 bottom-2 z-20 flex items-center justify-center gap-1.5">
          {mobileBannerSlides.map((slide, index) => {
            const isActive = index === activeSlide;

            return (
              <button
                aria-current={isActive ? "true" : undefined}
                aria-label={`Show banner ${index + 1}`}
                className={[
                  "h-2 rounded-full transition-all",
                  isActive ? "w-5 bg-[#287c30]" : "w-2 bg-white/80"
                ].join(" ")}
                key={slide.imageUrl}
                onClick={() => setActiveSlide(index)}
                type="button"
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MobileSectionHeader({
  actionHref,
  actionText,
  headingId,
  title
}: {
  actionHref?: string;
  actionText?: string;
  headingId?: string;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-3">
      <h2 className="text-lg font-semibold leading-6 text-[#173b1d]" id={headingId}>
        {title}
      </h2>
      {actionHref && actionText ? (
        <Link className={mobileLandingActionClassName} href={actionHref}>
          {actionText}
        </Link>
      ) : null}
    </div>
  );
}

function MobileCategoryCard({
  category,
  index
}: {
  category: CategoryNavigationItem;
  index: number;
}) {
  const Icon = fallbackCategoryIcons[index % fallbackCategoryIcons.length] ?? Grid2X2;

  return (
    <Link
      className="grid min-h-28 w-[6.4rem] shrink-0 content-center justify-items-center gap-2 rounded-xl border border-[#cfe9d2] bg-white px-2 py-3 text-center shadow-sm shadow-[#287c30]/5"
      href={category.href}
    >
      {category.imageUrl ? (
        <Image
          alt={getCategoryImageAlt(category.label)}
          className="h-12 w-12 rounded-lg object-cover"
          height={120}
          src={category.imageUrl}
          unoptimized={category.imageUrl.startsWith("http://localhost")}
          width={120}
        />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#eaf7eb] text-[#287c30]">
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
      )}
      <span className="line-clamp-2 text-xs font-semibold leading-4 text-[#173b1d]">
        {category.label}
      </span>
      <span className={mobileCategoryActionClassName}>
        Open catalog
      </span>
    </Link>
  );
}

function MobileFeaturedProductsByCategory({
  categories,
  productsByCategory
}: {
  categories: CategoryNavigationItem[];
  productsByCategory: Record<string, ProductList | undefined>;
}) {
  const populatedCategories = categories
    .map((category) => ({
      category,
      products: productsByCategory[category.slug]?.items.slice(0, 6) ?? []
    }))
    .filter(({ products }) => products.length > 0);

  if (populatedCategories.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="mobile-featured-products-title"
      className={mobileSectionClassName}
      id="mobile-category-products"
    >
      <MobileSectionHeader
        actionHref="/products"
        actionText="View all"
        headingId="mobile-featured-products-title"
        title="Featured products by category"
      />
      <div className="grid gap-8">
        {populatedCategories.map(({ category, products }) => (
          <section
            aria-label={`${category.label} featured products`}
            className="grid gap-3"
            key={category.id}
          >
            <div className="flex items-center justify-between gap-3 px-4">
              <h3 className="text-base font-semibold leading-5 text-[#173b1d]">
                {category.label}
              </h3>
              <Link
                aria-label={`Open ${category.label} catalog`}
                className={mobileLandingActionClassName}
                href={category.href}
              >
                Open Catalog
              </Link>
            </div>
            <div
              className={horizontalRailClassName}
              data-testid={`mobile-featured-rail-${category.slug}`}
            >
              {products.map((product) => (
                <MobileProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function MobileProductRail({
  products,
  title
}: {
  products: Product[];
  title: string;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className={mobileSectionClassName}>
      <MobileSectionHeader actionHref="/products" actionText="View All" title={title} />
      <div className={horizontalRailClassName} data-testid="mobile-product-rail">
        {products.map((product) => (
          <MobileProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function MobileProductCard({ product }: { product: Product }) {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const savings = getProductSavings(product);

  return (
    <article className="grid min-h-[14.3rem] w-[9.1rem] shrink-0 overflow-hidden rounded-xl border border-[#cfe9d2] bg-white shadow-sm shadow-[#287c30]/5">
      <Link className="relative block h-24 bg-[#f4fbf5]" href={`/products/${product.slug}`}>
        {image ? (
          <Image
            alt={getProductImageAlt(product.name, image.altText)}
            className="h-full w-full object-contain"
            fill
            src={image.url}
            unoptimized
          />
        ) : (
          <span className="grid h-full place-items-center text-[#287c30]">
            <HeartPulse aria-hidden="true" className="h-10 w-10" />
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded-lg border border-[#287c30] bg-white px-3 py-1 text-[11px] font-semibold text-[#287c30]">
          View
        </span>
      </Link>
      <div className="grid gap-1 p-3">
        <p className="text-[11px] font-semibold text-[#556b57]">
          {product.brand.name}
        </p>
        <h3 className="line-clamp-2 min-h-9 text-xs font-semibold leading-[1.15rem] text-[#173b1d]">
          {product.name}
        </h3>
        <p className="text-base font-black leading-5 text-[#111827]">
          {formatRupees(product.sellingPrice)}
        </p>
        <p className="text-[11px] font-semibold text-[#556b57]">
          <span className="line-through">{formatRupees(product.mrp)}</span>
          {savings ? (
            <span className="ml-1 text-[#008f5f]">{savings.percent}% OFF</span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
