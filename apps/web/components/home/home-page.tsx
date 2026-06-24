import Image from "next/image";
import { getBrands } from "../../lib/api/brands";
import { getCategories } from "../../lib/api/categories";
import { getProducts } from "../../lib/api/products";
import type { ProductList } from "../../lib/api/schemas";
import type { CategoryNavigationItem } from "../../lib/catalog/customer-navigation";
import {
  getFeaturedCategorySectionLimit,
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

export async function HomePage() {
  const [categories, brands, products] = await Promise.all([
    safeRead(getCategories()),
    safeRead(getBrands()),
    safeRead(
      getProducts({
        limit: getLandingProductLimit(),
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

        <section className="py-16" id="categories">
          <Container>
            <SectionHeader
              description="Open a focused catalog page for the departments hospitals and clinics order most often."
              title="Shop by procurement category"
              action={
                <Button href="/products" variant="outline">
                  Open full catalog
                </Button>
              }
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
          <section className="bg-white py-16" id="category-products">
            <Container>
              <SectionHeader
                description={`The first ${getFeaturedCategorySectionLimit()} main category previews each highlight ${getLandingProductLimit()} products and link directly into filtered catalog results.`}
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
              <div className="grid gap-10">
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
          <section className="py-16" id="products">
            <Container>
              <SectionHeader
                description="Recently added supplies from across the catalog for quick replenishment orders."
                title="Latest additions"
              />
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {products.items.map((product) => (
                  <ProductCard compact key={product.id} product={product} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        <section className="bg-white py-16" id="procurement">
          <Container>
            <SectionHeader
              description="Clear catalog structure, verified product data, and checkout support for repeat clinical purchasing."
              title="Built for clinical procurement"
            />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  body: "Browse departments, subcategories, brands, stock, and specialty filters without losing the current catalog context.",
                  title: "Focused navigation"
                },
                {
                  body: "Product cards surface MRP, hospital price, SKU, stock, GST, and sterile or disposable signals before checkout.",
                  title: "Procurement-ready details"
                },
                {
                  body: "Bulk requests, GST-ready invoices, and saved catalog filters keep repeat orders simple for clinics and hospitals.",
                  title: "Order support"
                }
              ].map((item) => (
                <article
                  className="rounded-lg border border-[#cfe9d2] bg-[#f8fcf8] p-5 shadow-sm shadow-[#287c30]/5"
                  key={item.title}
                >
                  <h3 className="text-lg font-bold text-[#173b1d]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#556b57]">{item.body}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section className="py-16" id="brands">
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
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eaf7eb] text-sm font-bold text-[#287c30]">
                        {brand.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <h3 className="text-sm font-bold leading-5 text-[#173b1d]">
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

        <section className="py-16" id="bulk">
          <Container>
            <div className="grid gap-8 rounded-[2rem] bg-[#287c30] p-7 text-white shadow-xl shadow-[#287c30]/15 lg:grid-cols-[0.85fr_1.15fr] lg:items-start md:p-10">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">
                  Planning a bulk order?
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                  Share SKUs, quantities, and delivery needs for a guided quote.
                </p>
                <div className="mt-5 grid gap-2 text-sm font-semibold text-white/80">
                  <p>Response status is saved for admin follow-up.</p>
                  <p>Use product SKUs from the catalog for faster pricing.</p>
                </div>
              </div>
              <BulkQuoteForm />
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
          limit: getLandingProductLimit(),
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
      className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      data-testid="landing-category-grid"
    >
      {categories.map((category) => (
        <article
          className="group grid min-h-72 overflow-hidden rounded-lg border border-[#cfe9d2] bg-white shadow-sm shadow-[#287c30]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#287c30] hover:shadow-lg hover:shadow-[#287c30]/10"
          key={category.id}
        >
          <a
            className="relative block h-32 overflow-hidden bg-[#eaf7eb]"
            href={category.href}
          >
            {category.imageUrl ? (
              <Image
                alt={getCategoryImageAlt(category.label)}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                fill
                sizes="(min-width: 1024px) 18vw, (min-width: 768px) 30vw, (min-width: 640px) 45vw, 100vw"
                src={category.imageUrl}
                unoptimized={category.imageUrl.startsWith("http://localhost")}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#eaf7eb,#ffffff)] text-4xl font-bold text-[#287c30]">
                {category.label.slice(0, 1)}
              </div>
            )}
          </a>
          <div className="grid content-between gap-4 p-4">
            <div>
              <h3 className="text-base font-bold leading-6 text-[#173b1d]">
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
          <h3 className="text-xl font-bold leading-7 text-[#173b1d] sm:text-2xl">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {products.items.slice(0, getLandingProductLimit()).map((product) => (
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
