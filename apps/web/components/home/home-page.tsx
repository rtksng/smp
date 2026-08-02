import Image from "next/image";
import {
  BadgeCheck,
  ClipboardList,
  Layers3,
  PackageCheck,
  ShieldCheck,
  Truck
} from "lucide-react";
import { getBrands } from "../../lib/api/brands";
import { getCategories } from "../../lib/api/categories";
import { getProducts } from "../../lib/api/products";
import type { ProductList } from "../../lib/api/schemas";
import type { CategoryNavigationItem } from "../../lib/catalog/customer-navigation";
import {
  getFeaturedCategorySectionLimit,
  getFeaturedCategoryProductLimit,
  getHomeBrandPreviewLimit,
  getLandingProductLimit,
  selectLandingCategories,
  selectProductReadyFeaturedCategories,
  selectPreviewBrands
} from "../../lib/catalog/storefront";
import { getBrandImageAlt, getCategoryImageAlt } from "../../lib/seo/metadata";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import {
  MarketplaceBanner,
  MarketplaceProofStrip
} from "../marketplace/marketplace-banner";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { ProductCard } from "../ui/product-card";
import { SectionHeader } from "../ui/section-header";
import { BulkQuoteForm } from "./bulk-quote-form";
import { MobileCommerceHome } from "./mobile-commerce-home";

const highlightedLandingButtonClassName =
  "whitespace-nowrap !border-[#a9ddae] !bg-[#eaf7eb] shadow-md shadow-[#287c30]/10";
const homeSectionClassName = "py-14 sm:py-16 lg:py-20";

export async function HomePage() {
  const [categories, brands, products] = await Promise.all([
    safeRead(getCategories()),
    safeRead(getBrands()),
    safeRead(
      getProducts({
        limit: getFeaturedCategoryProductLimit(),
        sort: "latest"
      })
    )
  ]);
  const banner = buildHomeBanner();
  const landingCategories = selectLandingCategories(categories);
  const previewBrands = selectPreviewBrands(brands);
  const featuredCategoryProducts =
    await loadFeaturedCategoryProducts(landingCategories);
  const featuredCategories = selectProductReadyFeaturedCategories(
    landingCategories,
    featuredCategoryProducts
  );

  return (
    <>
      <Header />
      <main className="bg-[#f4fbf5]">
        <MobileCommerceHome
          brands={brands ?? []}
          categories={categories ?? []}
          featuredCategories={featuredCategories}
          featuredCategoryProducts={featuredCategoryProducts}
          products={products?.items ?? []}
        />
        <div className="hidden md:block">
        <section className="bg-[#f4fbf5] pb-5 sm:pb-7">
          <Container>
            <MarketplaceBanner
              ctaHref={banner.ctaHref}
              ctaText={banner.ctaText}
              imageAlt={banner.imageAlt}
              imageUrl={banner.imageUrl}
              secondaryCtaHref={banner.secondaryCtaHref}
              secondaryCtaText={banner.secondaryCtaText}
              subtitle={banner.subtitle}
              title={banner.title}
              tone="forest"
            />
          </Container>
        </section>
        <MarketplaceProofStrip />

        <section className={homeSectionClassName} id="categories">
          <Container>
            <SectionHeader
              description="Open a focused catalog page for the departments hospitals and clinics order most often."
              title="Shop by procurement category"
            />
            {!categories ? (
              <ErrorState
                message="Category catalog data is unavailable right now."
                title="Unable to load categories"
              />
            ) : null}
            {categories && categories.length === 0 ? (
              <EmptyState
                description="No active customer categories are available yet."
                title="No categories found"
              />
            ) : null}
            {categories && categories.length > 0 ? (
              <LandingCategoryGrid categories={landingCategories} />
            ) : null}
          </Container>
        </section>

        {featuredCategories.length > 0 ? (
          <section className={`bg-white ${homeSectionClassName}`} id="category-products">
            <Container>
              <SectionHeader
                description={`The first ${getFeaturedCategorySectionLimit()} main category previews each highlight ${getFeaturedCategoryProductLimit()} products and link directly into filtered catalog results.`}
                title="Featured products by category"
                action={
                  <Button
                    className={highlightedLandingButtonClassName}
                    href="/products"
                    variant="outline"
                  >
                    View all products
                  </Button>
                }
              />
              <div className="grid gap-12">
                {featuredCategories.map((category) => (
                  <FeaturedCategorySection
                    category={category}
                    key={category.id}
                    products={featuredCategoryProducts[category.slug]}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {products && products.items.length > 0 ? (
          <section className={homeSectionClassName} id="products">
            <Container>
              <SectionHeader
                description="Recently added supplies from across the catalog for quick replenishment orders."
                title="Latest additions"
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {products.items.map((product) => (
                  <ProductCard compact key={product.id} product={product} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        <section className={`bg-white ${homeSectionClassName}`} id="procurement">
          <Container>
            <div className="relative overflow-hidden rounded-[2rem] border border-[#cfe9d2] bg-[radial-gradient(circle_at_10%_5%,#e4f6e7,transparent_27%),radial-gradient(circle_at_92%_100%,#d8f0dc,transparent_30%),#f8fcf8] px-5 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/3 -translate-y-1/3 rounded-full border-[22px] border-[#287c30]/10"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 -translate-x-1/3 translate-y-1/3 rounded-full border-[18px] border-[#287c30]/10"
              />

              <div className="relative">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_auto] lg:items-end">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#9ed8a3] bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#23702a] shadow-sm">
                      <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                      Procurement confidence
                    </span>
                    <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-[#173b1d] sm:text-3xl">
                      Built for clinical procurement
                    </h2>
                    <p className="mt-3 max-w-xl text-base leading-7 text-[#556b57]">
                      Source essential supplies with the information your purchase team needs: specification clarity, live availability, compliant billing, and dependable order support.
                    </p>
                  </div>

                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-3">
                  {[
                    {
                      accent: "bg-[#eaf7eb] text-[#23702a]",
                      body: "Start with the clinical need, then narrow the catalog by department, procedure, brand, or product type.",
                      details: ["Department-led discovery", "Procedure and brand filters"],
                      icon: Layers3,
                      number: "01",
                      title: "Source by clinical need"
                    },
                    {
                      accent: "bg-[#eef5ff] text-[#2563a6]",
                      body: "Compare pack size, SKU, sterile status, tax, pricing, and availability before your team raises a requisition.",
                      details: ["Clear purchase specifications", "Live availability checks"],
                      icon: ClipboardList,
                      number: "02",
                      title: "Verify before you buy"
                    },
                    {
                      accent: "bg-[#fff4e5] text-[#a15b11]",
                      body: "Keep routine purchasing moving with saved searches, bulk quote help, and GST-ready invoices for every order.",
                      details: ["Bulk quote assistance", "GST-ready order records"],
                      icon: Truck,
                      number: "03",
                      title: "Reorder with confidence"
                    }
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <article
                        className="group relative overflow-hidden rounded-2xl border border-white/90 bg-white/90 p-5 shadow-sm shadow-[#173b1d]/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#287c30]/10 sm:p-6"
                        key={item.title}
                      >
                        <span className="absolute right-5 top-5 text-xs font-black tracking-[0.16em] text-[#173b1d]/25">
                          {item.number}
                        </span>
                        <span className={`grid h-12 w-12 place-items-center rounded-2xl ${item.accent}`}>
                          <Icon aria-hidden="true" className="h-6 w-6" />
                        </span>
                        <h3 className="mt-5 pr-10 text-xl font-semibold tracking-[-0.02em] text-[#173b1d]">
                          {item.title}
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-[#556b57]">{item.body}</p>
                        <ul className="mt-5 grid gap-2 border-t border-[#e0eee2] pt-4 text-xs font-semibold text-[#426a48]">
                          {item.details.map((detail) => (
                            <li className="flex items-center gap-2" key={detail}>
                              <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[#287c30]" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section className={homeSectionClassName} id="brands">
          <Container>
            <SectionHeader
              description="Browse verified manufacturers and suppliers, then open their dedicated product listings."
              title="Trusted brands"
              action={
                <Button
                  className={highlightedLandingButtonClassName}
                  href="/brands"
                  variant="outline"
                >
                  View all brands
                </Button>
              }
            />
            {!brands ? (
              <ErrorState
                message="Brand catalog data is unavailable right now."
                title="Unable to load brands"
              />
            ) : null}
            {brands && brands.length === 0 ? (
              <EmptyState
                description="No active customer brands are available yet."
                title="No brands found"
              />
            ) : null}
            {brands && previewBrands.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                {previewBrands.map((brand) => (
                  <a
                    className="grid min-h-32 content-center justify-items-center gap-3 rounded-lg border border-[#cfe9d2] bg-white px-4 py-5 text-center shadow-sm shadow-[#287c30]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#287c30] hover:shadow-lg hover:shadow-[#287c30]/10"
                    href={`/brands/${brand.slug}`}
                    key={brand.id}
                  >
                    {brand.logoUrl ? (
                      <span className="flex h-12 w-full max-w-32 items-center justify-center overflow-hidden">
                        <Image
                          alt={getBrandImageAlt(brand.name)}
                          className="h-12 w-auto max-w-full object-contain"
                          height={260}
                          sizes="128px"
                          src={brand.logoUrl}
                          unoptimized={brand.logoUrl.startsWith("http://localhost")}
                          width={720}
                        />
                      </span>
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eaf7eb] text-sm font-semibold text-[#287c30]">
                        {brand.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <h3 className="text-sm font-semibold leading-5 text-[#173b1d]">
                      {brand.name}
                    </h3>
                  </a>
                ))}
              </div>
            ) : null}
            {brands && previewBrands.length > 0 ? (
              <p className="mt-5 text-sm font-semibold text-[#556b57]">
                Showing {Math.min(previewBrands.length, getHomeBrandPreviewLimit())}{" "}
                brand partners on the landing page.
              </p>
            ) : null}
          </Container>
        </section>

        <section className={homeSectionClassName} id="bulk">
          <Container>
            <div className="grid overflow-hidden rounded-[2rem] border border-[#1e6e27] bg-[#237b2c] text-white shadow-xl shadow-[#287c30]/15 lg:grid-cols-[0.88fr_1.12fr]">
              <div className="relative min-h-[24rem] overflow-hidden sm:min-h-[29rem]">
                <Image
                  alt="Organized hospital supplies prepared for a bulk procurement order"
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 38vw, 100vw"
                  src="/images/bulk-procurement-quote.png"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,64,24,0.12),rgba(10,56,18,0.9)_82%)]" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">
                    <PackageCheck aria-hidden="true" className="h-4 w-4" />
                    Bulk procurement
                  </span>
                  <h2 className="mt-4 max-w-sm text-2xl font-semibold leading-tight sm:text-3xl">
                    Plan your supply order with confidence.
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
                    Send your requirement once and receive practical support for quantities, delivery, and bulk pricing.
                  </p>
                  <div className="mt-5 grid gap-2 text-sm font-semibold text-white/90">
                    <p className="flex items-center gap-2">
                      <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                      Share item names or product SKUs
                    </p>
                    <p className="flex items-center gap-2">
                      <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                      Get a tailored quote for your location
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-[#237b2c] p-6 sm:p-8 lg:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c7eacb]">
                  Request a tailored quote
                </p>
                <h3 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                  Tell us what you need.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                  Add quantities, delivery city, and timing. Our team will follow up with the right procurement options.
                </p>
                <div className="mt-7">
                  <BulkQuoteForm />
                </div>
              </div>
            </div>
          </Container>
        </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function safeRead<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

async function loadFeaturedCategoryProducts(categories: CategoryNavigationItem[]) {
  const entries = await Promise.all(
    categories.map(async (category) => [
      category.slug,
      await safeRead(
        getProducts({
          category: category.slug,
          limit: getFeaturedCategoryProductLimit(),
          sort: "latest"
        })
      )
    ])
  );

  return Object.fromEntries(entries) as Record<string, ProductList | undefined>;
}

function LandingCategoryGrid({ categories }: { categories: CategoryNavigationItem[] }) {
  return (
    <div
      className="grid gap-5 lg:grid-cols-12"
      data-testid="landing-category-grid"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
        {categories.map((category) => (
          <article
            className="group grid min-h-56 overflow-hidden rounded-lg border border-[#cfe9d2] bg-white shadow-sm shadow-[#287c30]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#287c30] hover:shadow-lg hover:shadow-[#287c30]/10"
            key={category.id}
          >
            <a
              className="relative block h-24 overflow-hidden bg-[#eaf7eb]"
              href={category.href}
            >
              {category.imageUrl ? (
                <Image
                  alt={getCategoryImageAlt(category.label)}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  fill
                  sizes="(min-width: 1024px) 18vw, (min-width: 640px) 50vw, 100vw"
                  src={category.imageUrl}
                  unoptimized={category.imageUrl.startsWith("http://localhost")}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#eaf7eb,#ffffff)] text-3xl font-semibold text-[#287c30]">
                  {category.label.slice(0, 1)}
                </div>
              )}
            </a>
            <div className="grid content-between gap-3 p-4">
              <div>
                <h3 className="text-base font-semibold leading-6 text-[#173b1d]">
                  <a href={category.href}>{category.label}</a>
                </h3>
                {category.description ? (
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[#556b57]">
                    {category.description}
                  </p>
                ) : null}
              </div>
              <Button
                className="w-full whitespace-nowrap !min-h-10 !px-3 text-xs shadow-md shadow-[#287c30]/15 ring-1 ring-[#287c30]/15"
                href={category.href}
              >
                Open Catalog
              </Button>
            </div>
          </article>
        ))}
      </div>
      <aside className="group relative min-h-80 overflow-hidden rounded-[1.5rem] bg-[#eaf7eb] shadow-lg shadow-[#287c30]/10 lg:col-span-4">
        <Image
          alt="A selection of surgical and medical procurement supplies"
          className="object-cover transition duration-500 group-hover:scale-105"
          fill
          sizes="(min-width: 1024px) 42vw, 100vw"
          src="/images/category-procurement-fallback.png"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,47,18,0.04),rgba(13,47,18,0.78))]" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/75">
            Complete catalog
          </p>
          <h3 className="mt-2 max-w-sm text-2xl font-semibold leading-tight sm:text-3xl">
            Supplies for every clinical department
          </h3>
          <Button className="mt-5 !bg-white !text-[#173b1d]" href="/products">
            Browse all products
          </Button>
        </div>
      </aside>
    </div>
  );
}

function FeaturedCategorySection({
  category,
  products
}: {
  category: CategoryNavigationItem;
  products?: ProductList;
}) {
  return (
    <section className="border-t border-[#cfe9d2] pt-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold leading-7 text-[#173b1d] sm:text-2xl">
            {category.label}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#556b57]">
            {products
              ? `${products.pagination.total} catalog items available in this category.`
              : "Category products are unavailable right now."}
          </p>
        </div>
        <Button
          className={highlightedLandingButtonClassName}
          href={category.href}
          variant="outline"
        >
          Open Catalog
        </Button>
      </div>

      {products && products.items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {products.items.slice(0, getFeaturedCategoryProductLimit()).map((product) => (
            <ProductCard compact key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="Try the full catalog while this category preview refreshes."
          title="No featured products found"
        />
      )}
    </section>
  );
}

function buildHomeBanner() {
  return {
    ctaHref: "/products",
    ctaText: "Browse catalog",
    imageAlt: "Clinical supplies arranged for hospital procurement",
    imageUrl: "/banner/banner.png",
    secondaryCtaHref: "#bulk",
    secondaryCtaText: "Bulk quote",
    subtitle:
      "Your one-stop shop for verified surgical equipment, consumables, and diagnostics with GST-ready checkout.",
    title: "Hospital supplies, ordered simply."
  };
}
