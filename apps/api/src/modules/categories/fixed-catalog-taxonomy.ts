export const FIXED_ROOT_CATEGORY_SLUGS = [
  "dental",
  "diagnostics",
  "consumables",
  "equipment",
  "orthopedics",
  "ophthalmology",
  "nephrology",
  "pharma",
  "cardiology",
  "physiotherapy",
  "vaccines",
  "ivf-gynae"
] as const;

export function isFixedRootCategorySlug(slug: string) {
  return (FIXED_ROOT_CATEGORY_SLUGS as readonly string[]).includes(slug);
}
