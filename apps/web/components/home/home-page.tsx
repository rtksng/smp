import Image from "next/image";
import { getBrands } from "../../lib/api/brands";
import { getCategories } from "../../lib/api/categories";
import { getProducts } from "../../lib/api/products";
import type { Category } from "../../lib/api/schemas";
import { getBrandImageAlt } from "../../lib/seo/metadata";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { CategoryShowcase } from "../marketplace/category-showcase";
import { MarketplaceBanner } from "../marketplace/marketplace-banner";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { ProductCard } from "../ui/product-card";
import { SectionHeader } from "../ui/section-header";
import { SearchForm } from "./search-form";

export async function HomePage() {
  const [categories, brands, products] = await Promise.all([
    safeRead(getCategories()),
    safeRead(getBrands()),
    safeRead(
      getProducts({
        limit: 3,
        sort: "latest"
      })
    )
  ]);
  const banner = buildHomeBanner(categories);

  return (
    <>
      <Header />
      <main className="bg-[#f4f9ff]">
        <section className="border-b border-[#d6e7f8] bg-[#f4f9ff] py-8 sm:py-10">
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
              tone="navy"
            />
            <div className="mx-auto mt-6 max-w-3xl rounded-[1.5rem] border border-[#d6e7f8] bg-white p-2 shadow-sm shadow-[#0b5cab]/10 sm:rounded-full">
              <SearchForm id="hero-search" placeholder="Search products, SKU, brand" />
            </div>
          </Container>
        </section>

        <section className="py-16" id="categories">
          <Container>
            <SectionHeader
              title="Shop by department"
              action={
                <Button href="/products" variant="outline">
                  Open catalog
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
              <CategoryShowcase
                categories={categories}
                limit={4}
                showActionLink={false}
                showSubcategories={false}
              />
            ) : null}
          </Container>
        </section>

        {products && products.items.length > 0 ? (
          <section className="bg-[#f4f9ff] py-16" id="products">
            <Container>
              <SectionHeader
                title="Featured products"
                action={
                  <Button href="/products" variant="outline">
                    View all products
                  </Button>
                }
              />
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {products.items.map((product) => (
                  <ProductCard compact key={product.id} product={product} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        <section className="py-16" id="brands">
          <Container>
            <SectionHeader title="Trusted brands" />
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
            {brands && brands.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {brands.slice(0, 4).map((brand) => (
                  <a
                    className="flex min-h-24 items-center justify-center rounded-[1.25rem] border border-[#d6e7f8] bg-white px-6 py-5 shadow-sm shadow-[#0b5cab]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#0b5cab] hover:shadow-lg hover:shadow-[#0b5cab]/10"
                    href={`/brands/${brand.slug}`}
                    key={brand.id}
                  >
                    {brand.logoUrl ? (
                      <span className="flex h-14 w-full max-w-52 items-center justify-center overflow-hidden">
                        <Image
                          alt={getBrandImageAlt(brand.name)}
                          className="h-14 w-auto max-w-full object-contain"
                          height={260}
                          sizes="208px"
                          src={brand.logoUrl}
                          unoptimized={brand.logoUrl.startsWith("http://localhost")}
                          width={720}
                        />
                      </span>
                    ) : (
                      <h3 className="font-bold text-[#12314f]">{brand.name}</h3>
                    )}
                  </a>
                ))}
              </div>
            ) : null}
          </Container>
        </section>

        <section className="py-16" id="bulk">
          <Container>
            <div className="grid gap-8 rounded-[2rem] bg-[#0b4f9f] p-7 text-white shadow-xl shadow-[#0b5cab]/15 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">
                  Planning a bulk order?
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                  Share SKUs, quantities, and delivery needs for a guided quote.
                </p>
              </div>
              <Button
                className="w-full md:w-auto"
                href="mailto:support@surgical.example"
                variant="outline"
              >
                Request bulk quote
              </Button>
            </div>
          </Container>
        </section>
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

function buildHomeBanner(categories: Category[] | undefined) {
  const firstCategory = categories?.[0];

  return {
    ctaHref: "/products",
    ctaText: "Browse catalog",
    imageAlt: firstCategory
      ? `${firstCategory.name} medical procurement category`
      : "Clinical equipment and supplies prepared for hospital procurement",
    imageUrl:
      firstCategory?.imageUrl ??
      "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1200&q=80",
    secondaryCtaHref: "#bulk",
    secondaryCtaText: "Bulk quote",
    subtitle:
      "Shop verified surgical equipment, consumables, and diagnostics with GST-ready checkout.",
    title: "Hospital supplies, ordered simply."
  };
}
