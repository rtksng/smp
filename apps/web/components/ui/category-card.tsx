import Image from "next/image";
import type { Category } from "../../lib/api/schemas";
import { getCategoryImageAlt } from "../../lib/seo/metadata";

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <a
      className="group grid min-h-48 overflow-hidden rounded-lg border border-[#d8e2df] bg-white transition hover:-translate-y-0.5 hover:border-[#006d77] hover:shadow-lg"
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
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#e7f3f2,#f7e9c8)] text-3xl font-extrabold text-[#006d77]">
            {category.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="mb-2 text-xs font-extrabold uppercase text-[#9b6a1e]">
          Department
        </p>
        <h3 className="text-lg font-extrabold text-[#17211f]">{category.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#687773]">
          {category.description ?? "Explore surgical and medical products in this category."}
        </p>
        <p className="mt-4 text-sm font-extrabold text-[#006d77]">
          Browse catalog
          {category.children.length > 0 ? ` - ${category.children.length} subcategories` : ""}
        </p>
      </div>
    </a>
  );
}
