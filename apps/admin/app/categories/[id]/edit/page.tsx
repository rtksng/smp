import { CategoryManagementPage } from "../../_components/category-management";
import { getCategoryRouteId } from "../../../../lib/catalog-management";

type EditCategoryPageProps = {
  params?: Promise<{
    id?: string | string[];
  }>;
};

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const resolvedParams = (await params) ?? {};

  return (
    <CategoryManagementPage
      categoryId={getCategoryRouteId(resolvedParams.id)}
      view="edit"
    />
  );
}
