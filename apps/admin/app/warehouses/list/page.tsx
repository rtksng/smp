import { redirect } from "next/navigation";
import { WAREHOUSES_PATH } from "../../../lib/warehouse-management";

/** The list now lives on the main warehouses screen; keep old links and their filters working. */
export default async function WarehouseListPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }

  const search = query.toString();
  redirect(search ? `${WAREHOUSES_PATH}?${search}` : WAREHOUSES_PATH);
}
