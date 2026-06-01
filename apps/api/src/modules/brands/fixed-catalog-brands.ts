export const FIXED_CATALOG_BRANDS = [
  { name: "Mb+", slug: "mb-plus" },
  { name: "Abbott", slug: "abbott" },
  { name: "Contec", slug: "contec" },
  { name: "Volk", slug: "volk" },
  { name: "Orikam", slug: "orikam" },
  { name: "Healthium", slug: "healthium" },
  { name: "GC", slug: "gc" },
  { name: "J.Mitra", slug: "j-mitra" }
] as const;

export const FIXED_CATALOG_BRAND_SLUGS = FIXED_CATALOG_BRANDS.map(
  (brand) => brand.slug
);

export function isFixedCatalogBrandSlug(slug: string) {
  return (FIXED_CATALOG_BRAND_SLUGS as readonly string[]).includes(slug);
}
