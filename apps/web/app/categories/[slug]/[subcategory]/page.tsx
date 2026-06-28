import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductListingPage } from "../../../../components/products/product-listing-page";
import { PageLoader } from "../../../../components/ui/loading-spinner";
import { getCategory } from "../../../../lib/api/categories";
import { isNotFoundApiError } from "../../../../lib/api/error-messages";
import type { Category } from "../../../../lib/api/schemas";
import {
  getProductListingInitialData,
  type ProductListingSearchParams
} from "../../../../lib/catalog/listing-initial-data";
import { buildMetadata } from "../../../../lib/seo/metadata";

type SubcategoryPageProps = {
  params: Promise<{
    slug: string;
    subcategory: string;
  }>;
  searchParams?: Promise<ProductListingSearchParams>;
};

export async function generateMetadata({
  params
}: SubcategoryPageProps): Promise<Metadata> {
  const { slug, subcategory } = await params;

  try {
    const category = await getCategory(slug);
    const child = findActiveSubcategory(category, subcategory);

    if (!child) {
      notFound();
    }

    return buildMetadata({
      description:
        child.description ??
        `Shop ${child.name} in ${category.name} with GST invoices, stock filters, and secure checkout.`,
      image: child.imageUrl ?? category.imageUrl,
      path: `/categories/${slug}/${subcategory}`,
      title: `${child.name} Products`
    });
  } catch (error) {
    if (isNotFoundApiError(error)) {
      notFound();
    }

    return fallbackMetadata(slug, subcategory);
  }
}

export default async function SubcategoryPage({
  params,
  searchParams
}: SubcategoryPageProps) {
  const [{ slug, subcategory }, rawSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({})
  ]);
  const category = await getCategoryOrNotFound(slug);
  const child = findActiveSubcategory(category, subcategory);

  if (!child) {
    notFound();
  }

  const initial = await getProductListingInitialData(
    { slug, subcategorySlug: subcategory, type: "subcategory" },
    rawSearchParams
  );
  initial.data.category = category;

  return (
    <Suspense fallback={<PageLoader label="Loading subcategory products" />}>
      <ProductListingPage
        context={{ slug, subcategorySlug: subcategory, type: "subcategory" }}
        initialData={initial.data}
        initialFilters={initial.filters}
      />
    </Suspense>
  );
}

function findActiveSubcategory(category: Category, slug: string) {
  return category.children.find(
    (subcategory) => subcategory.slug === slug && subcategory.isActive
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

function fallbackMetadata(categorySlug: string, subcategorySlug: string) {
  return buildMetadata({
    description:
      "Browse subcategory-specific surgical and medical products with price, stock, specialty, and brand filters.",
    path: `/categories/${categorySlug}/${subcategorySlug}`,
    title: "Subcategory Products"
  });
}
