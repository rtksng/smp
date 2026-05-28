import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailPage } from "../../../components/products/product-detail-page";
import { isNotFoundApiError } from "../../../lib/api/error-messages";
import { getProduct } from "../../../lib/api/products";
import {
  buildMetadata,
  buildProductMetadata
} from "../../../lib/seo/metadata";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    return buildProductMetadata(await getProduct(slug));
  } catch {
    return buildMetadata({
      description:
        "Browse surgical and medical equipment with GST invoices, secure payments, and bulk purchase support.",
      path: `/products/${slug}`,
      title: "Medical Product"
    });
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductOrNotFound(slug);

  return <ProductDetailPage initialProduct={product} slug={slug} />;
}

async function getProductOrNotFound(slug: string) {
  try {
    return await getProduct(slug);
  } catch (error) {
    if (isNotFoundApiError(error)) {
      notFound();
    }

    throw error;
  }
}
