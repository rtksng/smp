import { BrandManagementPage } from "../../_components/brand-management";
import { getBrandRouteId } from "../../../../lib/catalog-management";

type EditBrandPageProps = {
  params?: Promise<{
    id?: string | string[];
  }>;
};

export default async function EditBrandPage({ params }: EditBrandPageProps) {
  const resolvedParams = (await params) ?? {};

  return (
    <BrandManagementPage brandId={getBrandRouteId(resolvedParams.id)} view="edit" />
  );
}
