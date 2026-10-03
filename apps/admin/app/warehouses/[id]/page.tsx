import { WarehouseDetailPage } from "../_components/warehouse-detail";

type WarehouseDetailRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WarehouseDetailRoutePage({
  params
}: WarehouseDetailRoutePageProps) {
  const { id } = await params;

  return <WarehouseDetailPage warehouseId={id} />;
}
