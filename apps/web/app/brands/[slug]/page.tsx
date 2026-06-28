import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductListingPage } from "../../../components/products/product-listing-page";
import { PageLoader } from "../../../components/ui/loading-spinner";
import { isNotFoundApiError } from "../../../lib/api/error-messages";
import { getBrand } from "../../../lib/api/brands";
import {
  getProductListingInitialData,
  type ProductListingSearchParams
} from "../../../lib/catalog/listing-initial-data";
import {
  buildBrandMetadata,
  buildMetadata
} from "../../../lib/seo/metadata";

type BrandPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<ProductListingSearchParams>;
};

export async function generateMetadata({
  params
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    return buildBrandMetadata(await getBrand(slug));
  } catch (error) {
    if (isNotFoundApiError(error)) {
      notFound();
    }

    return buildMetadata({
      description:
        "Browse brand-specific surgical and medical equipment with GST invoices and secure checkout.",
      path: `/brands/${slug}`,
      title: "Brand Products"
    });
  }
}

export default async function BrandPage({
  params,
  searchParams
}: BrandPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({})
  ]);
  const [brand, initial] = await Promise.all([
    getBrandOrNotFound(slug),
    getProductListingInitialData({ slug, type: "brand" }, rawSearchParams)
  ]);
  initial.data.brand = brand;

  return (
    <Suspense fallback={<PageLoader label="Loading brand products" />}>
      <ProductListingPage
        context={{ slug, type: "brand" }}
        initialData={initial.data}
        initialFilters={initial.filters}
      />
    </Suspense>
  );
}

async function getBrandOrNotFound(slug: string) {
  try {
    return await getBrand(slug);
  } catch (error) {
    if (isNotFoundApiError(error)) {
      notFound();
    }

    throw error;
  }
}
