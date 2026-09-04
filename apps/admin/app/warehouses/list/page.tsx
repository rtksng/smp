import { WarehouseManagementPage } from "../_components/warehouse-management";
import { createWarehouseFiltersFromSearchParams } from "../../../lib/warehouse-management";

export default async function WarehouseListPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const filters = createWarehouseFiltersFromSearchParams({
    get: (key) => {
      const value = params[key];
      return (Array.isArray(value) ? value[0] : value) ?? null;
    }
  });

  return <WarehouseManagementPage initialFilters={filters} view="list" />;
}
