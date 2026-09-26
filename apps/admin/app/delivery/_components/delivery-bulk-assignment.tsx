"use client";

import { useState } from "react";
import {
  BulkActions,
  BulkPageCheckbox,
  BulkRowCheckbox
} from "@/components/admin/bulk-actions";
import { BulkSelectField } from "@/components/admin/product-bulk-actions";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useAdminSession } from "@/lib/admin-session";
import { deliveryBulkAction } from "@/lib/bulk-module-actions";
import type { AdminDeliveryPartner } from "@/lib/delivery-management";
import type { AdminOrder } from "@/lib/order-management";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import type { WarehouseListResponse } from "@/lib/warehouse-management";

export function DeliveryBulkAssignment({
  orders,
  partners,
  warehouses,
  disabled,
  onComplete
}: {
  orders: AdminOrder[];
  partners: AdminDeliveryPartner[];
  warehouses: WarehouseListResponse["items"];
  disabled: boolean;
  onComplete: () => Promise<unknown>;
}) {
  const { api } = useAdminSession();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [values, setValues] = useState({
    deliveryPartnerId: "",
    pickupWarehouseId: "",
    note: ""
  });
  const filtered = orders.filter((order) =>
    [
      order.orderNumber,
      order.customer?.firstName,
      order.customer?.mobileNumber,
      order.warehouse?.name
    ].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()))
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  const bulk = useBulkSelection(search, visible);
  const partner = partners.find((item) => item.id === values.deliveryPartnerId);
  const warehouse = warehouses.find((item) => item.id === values.pickupWarehouseId);
  const action = deliveryBulkAction(
    api,
    values,
    partner?.fullName ?? "",
    warehouse?.name ?? ""
  );
  action.fields = (
    <>
      <BulkSelectField
        label="Bulk delivery partner"
        value={values.deliveryPartnerId}
        options={partners.map((item) => ({
          id: item.id,
          name: `${item.fullName} (${item.mobileNumber})`
        }))}
        onChange={(deliveryPartnerId) => setValues({ ...values, deliveryPartnerId })}
      />
      <BulkSelectField
        label="Bulk pickup warehouse"
        value={values.pickupWarehouseId}
        options={warehouses}
        placeholder="Use each order's warehouse"
        onChange={(pickupWarehouseId) => setValues({ ...values, pickupWarehouseId })}
      />
      <label>
        Dispatch note (optional)
        <Input
          maxLength={500}
          value={values.note}
          onChange={(event) => setValues({ ...values, note: event.target.value })}
        />
      </label>
    </>
  );
  return (
    <section className="bulkDeliverySection" aria-label="Bulk delivery assignment">
      <h3>Assign multiple orders</h3>
      <p>
        Select confirmed or packed orders, then choose a partner and pickup warehouse.
      </p>
      <label>
        Search ready orders
        <Input
          value={search}
          placeholder="Order, customer or warehouse"
          disabled={bulk.isBusy}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </label>
      <BulkActions
        key={bulk.scope}
        selection={bulk}
        actions={[action]}
        total={filtered.length}
        disabled={disabled}
        loadAll={async () => filtered}
        getLabel={(order) => order.orderNumber}
        onComplete={onComplete}
      />
      <div className="deliveryTableShell deliveryBulkTableShell">
        <p className="deliveryTableHint">Swipe sideways to view every selected-order option.</p>
        <div className="resourceTable deliveryBulkOrderTable">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bulkCheckboxCell">
                  <BulkPageCheckbox selection={bulk} />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warehouse</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="bulkCheckboxCell">
                    <BulkRowCheckbox
                      selection={bulk}
                      item={order}
                      label={order.orderNumber}
                    />
                  </TableCell>
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{order.customer?.firstName ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>{order.warehouse?.name ?? "Unassigned"}</TableCell>
                </TableRow>
              ))}
              {!visible.length ? (
                <TableRow>
                  <TableCell colSpan={5}>No ready orders match your search.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
      <PaginationControls
        page={currentPage}
        pageSize={20}
        totalItems={filtered.length}
        totalPages={Math.max(1, Math.ceil(filtered.length / 20))}
        onChange={(next) => {
          if (!bulk.isBusy) setPage(next);
        }}
      />
    </section>
  );
}
