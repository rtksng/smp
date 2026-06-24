import { BrandsDirectory } from "../../components/brands/brands-directory";
import { Footer } from "../../components/layout/footer";
import { Header } from "../../components/layout/header";
import { Button } from "../../components/ui/button";
import { Container } from "../../components/ui/container";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { getBrands } from "../../lib/api/brands";
import { getProducts } from "../../lib/api/products";
import type { ProductList } from "../../lib/api/schemas";
import { getLandingProductLimit } from "../../lib/catalog/storefront";
import { buildMetadata } from "../../lib/seo/metadata";

export const metadata = buildMetadata({
  description:
    "Search verified surgical and medical brands, filter by logo availability, and open brand-specific product listings.",
  path: "/brands",
  title: "Medical Equipment Brands"
});

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await safeRead(getBrands());
  const activeBrands = brands?.filter((brand) => brand.isActive) ?? [];
  const brandProducts = Object.fromEntries(
    await Promise.all(
      activeBrands.map(async (brand) => [
        brand.slug,
        await safeRead(
          getProducts({
            brand: brand.slug,
            limit: getLandingProductLimit(),
            sort: "latest"
          })
        )
      ])
    )
  ) as Record<string, ProductList | undefined>;

  return (
    <>
      <Header />
      <main className="bg-[#f4fbf5]">
        <section className="border-b border-[#cfe9d2] bg-white py-10 sm:py-12">
          <Container className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold leading-tight text-[#173b1d] sm:text-5xl">
                Browse trusted medical brands
              </h1>
              <p className="mt-4 text-base leading-7 text-[#556b57] sm:text-lg">
                Search supplier and manufacturer catalogs, compare brand ranges,
                and open filtered product listings for faster procurement.
              </p>
            </div>
            <Button href="/products" variant="outline">
              Open full catalog
            </Button>
          </Container>
        </section>

        <section className="py-10 sm:py-12">
          <Container>
            {!brands ? (
              <ErrorState
                message="Brand catalog data is unavailable right now."
                title="Unable to load brands"
              />
            ) : null}
            {brands && activeBrands.length === 0 ? (
              <EmptyState
                description="No active customer brands are available yet."
                title="No brands found"
              />
            ) : null}
            {activeBrands.length > 0 ? (
              <BrandsDirectory brandProducts={brandProducts} brands={activeBrands} />
            ) : null}
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
