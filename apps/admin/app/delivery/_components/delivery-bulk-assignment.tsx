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
import {
  filterPartnersForWarehouse,
  getDispatchCustomerName,
  isPartnerAssignedToWarehouse,
  type AdminDeliveryPartner,
  type DispatchQueueOrder
} from "@/lib/delivery-management";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { useTableOverflow } from "@/lib/use-table-overflow";
import type { WarehouseListResponse } from "@/lib/warehouse-management";

export function DeliveryBulkAssignment({
  orders,
  partners,
  warehouses,
  disabled,
  onComplete
}: {
  orders: DispatchQueueOrder[];
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
      order.customer.businessName,
      order.customer.fullName,
      order.customer.mobileNumber,
      order.warehouse?.name
    ].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()))
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  const bulk = useBulkSelection(search, visible);
  const { isOverflowing, shellRef } = useTableOverflow();
  // With a pickup warehouse chosen, only partners assigned to it can be dispatched from it.
  const partnerOptions = filterPartnersForWarehouse(partners, values.pickupWarehouseId);
  const partner = partnerOptions.find((item) => item.id === values.deliveryPartnerId);
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
        options={partnerOptions.map((item) => ({
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
        onChange={(pickupWarehouseId) => {
          const selected = partners.find((item) => item.id === values.deliveryPartnerId);
          // Clear a partner who does not serve the newly chosen pickup warehouse.
          const keepsPartner =
            !selected || !pickupWarehouseId || isPartnerAssignedToWarehouse(selected, pickupWarehouseId);

          setValues({
            ...values,
            deliveryPartnerId: keepsPartner ? values.deliveryPartnerId : "",
            pickupWarehouseId
          });
        }}
      />
      {values.pickupWarehouseId && partnerOptions.length === 0 ? (
        <p className="bulkFieldHint" role="status">
          No active delivery partner is assigned to {warehouse?.name ?? "this warehouse"}. Choose
          another pickup warehouse or assign a partner to it first.
        </p>
      ) : (
        <p className="bulkFieldHint">
          {values.pickupWarehouseId
            ? `Showing partners assigned to ${warehouse?.name ?? "this warehouse"}.`
            : "Without a pickup warehouse, the partner must be assigned to each order's warehouse."}
        </p>
      )}
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
      <div
        className="deliveryTableShell deliveryBulkTableShell"
        data-overflowing={isOverflowing ? "true" : undefined}
        ref={shellRef}
      >
        {isOverflowing ? (
          <p className="deliveryTableHint" id="delivery-bulk-table-hint">
            Swipe sideways to view every selected-order option.
          </p>
        ) : null}
        <div className="resourceTable deliveryBulkOrderTable">
          <Table aria-describedby="delivery-bulk-table-hint" aria-label="Ready orders">
            <TableHeader>
              <TableRow>
                <TableHead className="bulkCheckboxCell">
                  <BulkPageCheckbox selection={bulk} />
                </TableHead>
                <TableHead className="deliveryBulkOrderCell">Order</TableHead>
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
                  <TableCell className="deliveryBulkOrderCell">
                    <strong>{order.orderNumber}</strong>
                  </TableCell>
                  <TableCell className="deliveryBulkCustomerCell" data-label="Customer">
                    {getDispatchCustomerName(order)}
                  </TableCell>
                  <TableCell className="deliveryStatusCell">
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="deliveryBulkWarehouseCell" data-label="Warehouse">
                    {order.warehouse?.name ?? "Unassigned"}
                  </TableCell>
                </TableRow>
              ))}
              {!visible.length ? (
                <TableRow className="deliveryBulkEmptyRow">
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
