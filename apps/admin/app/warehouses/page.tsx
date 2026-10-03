import { WarehouseManagementPage } from "./_components/warehouse-management";
import { createWarehouseFiltersFromRouteParams } from "../../lib/warehouse-management";

export default async function WarehousesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = createWarehouseFiltersFromRouteParams((await searchParams) ?? {});

  return <WarehouseManagementPage initialFilters={filters} view="list" />;
}
