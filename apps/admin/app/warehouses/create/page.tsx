import { WarehouseManagementPage } from "../_components/warehouse-management";
import {
  getWarehouseEditId,
  getWarehouseReturnToPath
} from "../../../lib/warehouse-management";

type CreateWarehousePageProps = {
  searchParams?: Promise<{
    edit?: string | string[];
    returnTo?: string | string[];
  }>;
};

export default async function CreateWarehousePage({
  searchParams
}: CreateWarehousePageProps) {
  const params = (await searchParams) ?? {};

  return (
    <WarehouseManagementPage
      initialEditWarehouseId={getWarehouseEditId(params.edit)}
      returnToPath={getWarehouseReturnToPath(params.returnTo)}
      view="create"
    />
  );
}
