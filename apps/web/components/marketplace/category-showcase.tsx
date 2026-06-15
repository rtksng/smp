import { ArrowRight, Layers3 } from "lucide-react";
import Image from "next/image";
import type { Category } from "../../lib/api/schemas";
import { buildCategoryNavigation } from "../../lib/catalog/customer-navigation";
import { getCategoryImageAlt } from "../../lib/seo/metadata";

type CategoryShowcaseProps = {
  categories: Category[];
  limit?: number;
  showActionLink?: boolean;
  showSubcategories?: boolean;
};

export function CategoryShowcase({
  categories,
  limit = 4,
  showActionLink = true,
  showSubcategories = true
}: CategoryShowcaseProps) {
  const navigation = buildCategoryNavigation(categories, limit);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {navigation.map((category) => (
        <article
          className="group grid overflow-hidden rounded-[1.25rem] border border-[#d6e7f8] bg-white shadow-sm shadow-[#0b5cab]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#0b5cab] hover:shadow-lg hover:shadow-[#0b5cab]/10"
          key={category.id}
        >
          <a
            className="relative block h-36 overflow-hidden bg-[#edf6ff]"
            href={category.href}
          >
            {category.imageUrl ? (
              <Image
                alt={getCategoryImageAlt(category.label)}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                src={category.imageUrl}
                unoptimized={category.imageUrl.startsWith("http://localhost")}
              />
            ) : (
              <div className="flex h-full items-center justify-between bg-[linear-gradient(135deg,#edf6ff,#ffffff)] px-5 text-[#0b5cab]">
                <span className="text-4xl font-bold">
                  {category.label.slice(0, 1)}
                </span>
                <Layers3 aria-hidden="true" className="h-12 w-12 opacity-70" />
              </div>
            )}
          </a>
          <div className="grid content-between gap-4 p-5">
            <div>
              <a
                className="text-lg font-bold leading-6 text-[#12314f] hover:text-[#0b5cab]"
                href={category.href}
              >
                {category.label}
              </a>
            </div>
            {showSubcategories || showActionLink ? (
              <div className="grid gap-3">
                {showSubcategories && category.children.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {category.children.slice(0, 2).map((subcategory) => (
                      <a
                        className="rounded-full border border-[#d6e7f8] bg-[#f4f9ff] px-3 py-1.5 text-xs font-bold text-[#12314f] transition hover:border-[#0b5cab] hover:bg-[#edf6ff] hover:text-[#0b5cab]"
                        href={subcategory.href}
                        key={subcategory.id}
                      >
                        {subcategory.label}
                      </a>
                    ))}
                  </div>
                ) : null}
                {showActionLink ? (
                  <a
                    className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#0b5cab]"
                    href={category.href}
                  >
                    Browse
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
