import type { Metadata } from "next";

export const siteName = "Surgical Medical Equipment";
export const defaultTitle = "Surgical Medical Equipment";
export const defaultDescription =
  "Shop genuine surgical and medical equipment with GST invoices, secure payments, and bulk purchase support.";

type BuildMetadataInput = {
  description: string;
  image?: string | null;
  imageAlt?: string;
  path: string;
  title: string;
};

type ProductMetadataRecord = {
  description: string;
  images: Array<{
    altText: string | null;
    id?: string;
    isPrimary: boolean;
    sortOrder?: number;
    url: string;
  }>;
  metaDescription: string | null;
  metaTitle: string | null;
  name: string;
  shortDescription: string;
  slug: string;
};

type CategoryMetadataRecord = {
  description: string | null;
  imageUrl: string | null;
  name: string;
  slug: string;
};

type BrandMetadataRecord = {
  description: string | null;
  logoUrl: string | null;
  name: string;
  slug: string;
};

export function getSiteUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    return new URL(rawUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function getAbsoluteUrl(path: string) {
  const baseUrl = getSiteUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(normalizedPath, baseUrl).toString();
}

export function buildMetadata({
  description,
  image,
  imageAlt,
  path,
  title
}: BuildMetadataInput): Metadata {
  const canonical = getAbsoluteUrl(path);
  const trimmedDescription = trimMetaDescription(description);
  const images = image
    ? [
        {
          alt: imageAlt ?? title,
          url: image
        }
      ]
    : undefined;

  return {
    alternates: {
      canonical
    },
    description: trimmedDescription,
    openGraph: {
      description: trimmedDescription,
      images,
      siteName,
      title,
      type: "website",
      url: canonical
    },
    title,
    twitter: {
      card: image ? "summary_large_image" : "summary",
      description: trimmedDescription,
      images: image ? [image] : undefined,
      title
    }
  };
}

export function buildPrivateMetadata(input: BuildMetadataInput): Metadata {
  return {
    ...buildMetadata(input),
    robots: {
      follow: false,
      googleBot: {
        follow: false,
        index: false
      },
      index: false
    }
  };
}

export function buildProductMetadata(product: ProductMetadataRecord): Metadata {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];

  return buildMetadata({
    description:
      product.metaDescription ??
      product.shortDescription ??
      trimMetaDescription(product.description),
    image: image?.url,
    imageAlt: image ? getProductImageAlt(product.name, image.altText) : undefined,
    path: `/products/${product.slug}`,
    title: product.metaTitle ?? `${product.name} | ${siteName}`
  });
}

export function buildCategoryMetadata(category: CategoryMetadataRecord): Metadata {
  return buildMetadata({
    description:
      category.description ??
      `Shop ${category.name} surgical and medical products with GST invoices and secure checkout.`,
    image: category.imageUrl,
    imageAlt: getCategoryImageAlt(category.name),
    path: `/categories/${category.slug}`,
    title: `${category.name} Surgical Products`
  });
}

export function buildBrandMetadata(brand: BrandMetadataRecord): Metadata {
  return buildMetadata({
    description:
      brand.description ??
      `Shop ${brand.name} surgical and medical equipment with GST invoices and secure checkout.`,
    image: brand.logoUrl,
    imageAlt: getBrandImageAlt(brand.name),
    path: `/brands/${brand.slug}`,
    title: `${brand.name} Medical Equipment`
  });
}

export function trimMetaDescription(description: string, maxLength = 160) {
  const normalized = description.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const suffix = "...";
  const limit = Math.max(0, maxLength - suffix.length);
  const trimmed = normalized.slice(0, limit);
  const lastSpace = trimmed.lastIndexOf(" ");
  const safeText = lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;

  return `${safeText.trimEnd()}${suffix}`;
}

export function getProductImageAlt(productName: string, imageAlt: string | null | undefined) {
  return imageAlt?.trim() || `${productName} product image`;
}

export function getCategoryImageAlt(categoryName: string) {
  return `${categoryName} category image`;
}

export function getBrandImageAlt(brandName: string) {
  return `${brandName} brand logo`;
}
