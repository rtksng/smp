import { WarehouseManagementPage } from "../_components/warehouse-management";
import { createWarehouseFiltersFromRouteParams } from "../../../lib/warehouse-management";

export default async function WarehouseStaffPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // A ?warehouseId= link narrows the picker to that warehouse, which the staff view then selects.
  const filters = createWarehouseFiltersFromRouteParams((await searchParams) ?? {});

  return <WarehouseManagementPage initialFilters={filters} view="staff" />;
}
