import { getProductRouteId } from "../../../../lib/product-form";
import { ProductManagementPage } from "../../product-management";

type EditProductPageProps = {
  params?: Promise<{
    id?: string | string[];
  }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const resolvedParams = (await params) ?? {};

  return (
    <ProductManagementPage
      productId={getProductRouteId(resolvedParams.id)}
      view="edit"
    />
  );
}
