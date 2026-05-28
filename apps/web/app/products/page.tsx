import { Suspense } from "react";
import { ProductListingPage } from "../../components/products/product-listing-page";
import { PageLoader } from "../../components/ui/loading-spinner";
import {
  getProductListingInitialData,
  type ProductListingSearchParams
} from "../../lib/catalog/listing-initial-data";
import { buildMetadata } from "../../lib/seo/metadata";

export const metadata = buildMetadata({
  description:
    "Browse surgical instruments, medical consumables, diagnostics, and hospital equipment with filterable catalog search.",
  path: "/products",
  title: "Surgical and Medical Products"
});

type ProductsPageProps = {
  searchParams?: Promise<ProductListingSearchParams>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const initial = await getProductListingInitialData(
    { type: "all" },
    (await searchParams) ?? {}
  );

  return (
    <Suspense fallback={<PageLoader label="Loading products" />}>
      <ProductListingPage
        context={{ type: "all" }}
        initialData={initial.data}
        initialFilters={initial.filters}
      />
    </Suspense>
  );
}
