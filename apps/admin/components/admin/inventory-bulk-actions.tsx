"use client";

import { useState } from "react";
import { BulkActions } from "./bulk-actions";
import { BulkSelectField } from "./product-bulk-actions";
import { Input } from "@/components/ui/input";
import { useAdminSession } from "@/lib/admin-session";
import {
  inventoryBulkActions,
  type BulkInventoryRow,
  type BulkInventoryValues
} from "@/lib/bulk-resource-actions";
import type { BulkSelection } from "@/lib/use-bulk-selection";
import type { AdminWarehouse } from "@/lib/warehouse-management";

export function InventoryBulkActions({
  selection,
  warehouses,
  getLabel,
  total,
  disabled,
  loadAll,
  onComplete
}: {
  selection: BulkSelection<BulkInventoryRow>;
  warehouses: AdminWarehouse[];
  getLabel: (row: BulkInventoryRow) => string;
  total: number;
  disabled: boolean;
  loadAll: () => Promise<BulkInventoryRow[]>;
  onComplete: () => Promise<unknown>;
}) {
  const { api } = useAdminSession();
  const [values, setValues] = useState<BulkInventoryValues>({
    quantity: "",
    reason: "",
    toWarehouseId: "",
    batchNumbers: {}
  });
  const activeWarehouses = warehouses.filter((item) => item.status === "ACTIVE");
  const warehouse = activeWarehouses.find((item) => item.id === values.toWarehouseId);
  const actions = inventoryBulkActions(
    api,
    values,
    selection.selected,
    warehouse?.name ?? ""
  ).map((action) => ({
    ...action,
    fields: (
      <>
        <label>
          {action.id === "adjust" ? "Quantity change per batch" : "Quantity per batch"}
          <Input
            inputMode="numeric"
            value={values.quantity}
            onChange={(event) => setValues({ ...values, quantity: event.target.value })}
          />
        </label>
        {action.id === "transfer" ? (
          <BulkSelectField
            label="Destination warehouse"
            value={values.toWarehouseId}
            options={activeWarehouses}
            onChange={(toWarehouseId) => setValues({ ...values, toWarehouseId })}
          />
        ) : null}
        <label>
          Stock movement reason
          <Input
            maxLength={1000}
            value={values.reason}
            onChange={(event) => setValues({ ...values, reason: event.target.value })}
          />
        </label>
        {selection.selected.some((row) => !("batchNumber" in row)) ? (
          <div className="bulkInventoryBatches">
            <p className="bulkSelectionHint">
              Enter the existing batch number to process for each selected stock record.
            </p>
            {selection.selected
              .filter((row) => !("batchNumber" in row))
              .map((row) => (
                <label key={row.id}>
                  {getLabel(row)}
                  <Input
                    aria-label={`Batch number for ${getLabel(row)}`}
                    maxLength={120}
                    value={values.batchNumbers[row.id] ?? ""}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        batchNumbers: {
                          ...values.batchNumbers,
                          [row.id]: event.target.value
                        }
                      })
                    }
                  />
                </label>
              ))}
          </div>
        ) : null}
      </>
    )
  }));
  return (
    <BulkActions
      selection={selection}
      actions={actions}
      total={total}
      disabled={disabled}
      loadAll={loadAll}
      getLabel={getLabel}
      onComplete={onComplete}
    />
  );
}
