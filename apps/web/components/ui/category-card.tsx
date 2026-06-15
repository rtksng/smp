import Image from "next/image";
import type { Category } from "../../lib/api/schemas";
import { getCategoryImageAlt } from "../../lib/seo/metadata";

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <a
      className="group grid min-h-48 overflow-hidden rounded-lg border border-[#d6e7f8] bg-white shadow-sm shadow-[#0b5cab]/5 transition hover:-translate-y-0.5 hover:border-[#0b5cab] hover:shadow-lg hover:shadow-[#0b5cab]/10"
      href={`/categories/${category.slug}`}
    >
      <div className="relative h-32 overflow-hidden bg-[#e7f3f2]">
        {category.imageUrl ? (
          <Image
            alt={getCategoryImageAlt(category.name)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            src={category.imageUrl}
            unoptimized={category.imageUrl.startsWith("http://localhost")}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#e7f3f2,#f7e9c8)] text-3xl font-bold text-[#006d77]">
            {category.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="mb-2 text-xs font-bold uppercase text-[#9b6a1e]">
          Department
        </p>
        <h3 className="text-lg font-bold text-[#17211f]">{category.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#687773]">
          {category.description ?? "Explore surgical and medical products in this category."}
        </p>
        <p className="mt-4 text-sm font-bold text-[#006d77]">
          Browse catalog
          {category.children.length > 0 ? ` - ${category.children.length} subcategories` : ""}
        </p>
      </div>
    </a>
  );
}
