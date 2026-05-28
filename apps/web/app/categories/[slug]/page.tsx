import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductListingPage } from "../../../components/products/product-listing-page";
import { isNotFoundApiError } from "../../../lib/api/error-messages";
import { getCategory } from "../../../lib/api/categories";
import {
  getProductListingInitialData,
  type ProductListingSearchParams
} from "../../../lib/catalog/listing-initial-data";
import {
  buildCategoryMetadata,
  buildMetadata
} from "../../../lib/seo/metadata";
import { PageLoader } from "../../../components/ui/loading-spinner";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<ProductListingSearchParams>;
};

export async function generateMetadata({
  params
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    return buildCategoryMetadata(await getCategory(slug));
  } catch {
    return buildMetadata({
      description:
        "Browse category-specific surgical and medical products with price, stock, specialty, and clinical-use filters.",
      path: `/categories/${slug}`,
      title: "Category Products"
    });
  }
}

export default async function CategoryPage({
  params,
  searchParams
}: CategoryPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({})
  ]);
  const [category, initial] = await Promise.all([
    getCategoryOrNotFound(slug),
    getProductListingInitialData({ slug, type: "category" }, rawSearchParams ?? {})
  ]);
  initial.data.category = category;

  return (
    <Suspense fallback={<PageLoader label="Loading category products" />}>
      <ProductListingPage
        context={{ slug, type: "category" }}
        initialData={initial.data}
        initialFilters={initial.filters}
      />
    </Suspense>
  );
}

async function getCategoryOrNotFound(slug: string) {
  try {
    return await getCategory(slug);
  } catch (error) {
    if (isNotFoundApiError(error)) {
      notFound();
    }

    throw error;
  }
}
