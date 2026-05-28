import type { MetadataRoute } from "next";
import { getBrands } from "../lib/api/brands";
import { getCategories } from "../lib/api/categories";
import { getProducts } from "../lib/api/products";
import type { Category } from "../lib/api/schemas";
import { getAbsoluteUrl } from "../lib/seo/metadata";

const staticRoutes = ["/", "/products"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands] = await Promise.all([
    safeRead(getProducts({ limit: 100 })),
    safeRead(getCategories()),
    safeRead(getBrands())
  ]);
  const now = new Date();

  return [
    ...staticRoutes.map((route) => sitemapEntry(route, now, "daily", 0.8)),
    ...(products?.items ?? []).map((product) =>
      sitemapEntry(`/products/${product.slug}`, new Date(product.updatedAt), "daily", 0.7)
    ),
    ...flattenCategories(categories ?? []).map((category) =>
      sitemapEntry(`/categories/${category.slug}`, now, "weekly", 0.6)
    ),
    ...(brands ?? []).map((brand) =>
      sitemapEntry(`/brands/${brand.slug}`, now, "weekly", 0.6)
    )
  ];
}

function sitemapEntry(
  route: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number
): MetadataRoute.Sitemap[number] {
  return {
    changeFrequency,
    lastModified,
    priority,
    url: getAbsoluteUrl(route)
  };
}

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children)
  ]);
}

async function safeRead<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}
