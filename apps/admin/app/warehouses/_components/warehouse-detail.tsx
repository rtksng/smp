"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Eye,
  History,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Truck,
  Users,
  X
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useClientPagination } from "@/lib/use-client-pagination";
import { AdminShell } from "../../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import type {
  AdminDeliveryPartner,
  PaginatedResponse as DeliveryPaginatedResponse
} from "../../../lib/delivery-management";
import {
  INVENTORY_MOVEMENTS_PATH,
  INVENTORY_OVERVIEW_PATH,
  getStockLevel,
  type InventoryStock,
  type PaginatedResponse,
  type StockBatch
} from "../../../lib/inventory-management";
import { formatDateTime } from "../../../lib/order-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import { buildProductEditPath } from "../../../lib/product-form";
import {
  WAREHOUSES_PATH,
  WAREHOUSE_NEAR_EXPIRY_DAYS,
  buildWarehouseDetailPath,
  buildWarehouseEditPath,
  buildWarehousePartnerQuery,
  buildWarehouseQuickLinks,
  buildWarehouseScopedHref,
  buildWarehouseStaffPath,
  buildWarehouseStockQuery,
  formatWarehouseCoordinates,
  formatWarehouseStatus,
  getWarehouseDetailError,
  normalizeWarehouseProductSearch,
  type AdminWarehouse,
  type WarehouseStaffAssignment
} from "../../../lib/warehouse-management";
import "../warehouse-responsive.css";

type WarehouseStockSummary = {
  lowStock: number;
  nearExpiry: number;
  products: number;
};

export function WarehouseDetailPage({ warehouseId }: { warehouseId: string }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.WarehouseRead}>
        <WarehouseDetailContent warehouseId={warehouseId} />
      </ProtectedRoute>
    </AdminShell>
  );
}

export function WarehouseDetailContent({ warehouseId }: { warehouseId: string }) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [productSearchDraft, setProductSearchDraft] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [partnerPage, setPartnerPage] = useState(1);

  const canManage = hasPermission(ADMIN_PERMISSION.WarehouseManage);
  const canManageStaff = hasPermission(ADMIN_PERMISSION.WarehouseStaffManage);
  const canReadDelivery = hasPermission(ADMIN_PERMISSION.DeliveryRead);
  const canReadInventory = hasPermission(ADMIN_PERMISSION.InventoryRead);
  const canReadProducts = hasPermission(ADMIN_PERMISSION.ProductsRead);
  const warehousePath = `/admin/warehouses/${encodeURIComponent(warehouseId)}`;

  const warehouseQuery = useQuery({
    queryFn: ({ signal }) => api.request<AdminWarehouse>(warehousePath, { signal }),
    queryKey: ["admin", "warehouses", warehouseId]
  });
  const warehouse = warehouseQuery.data ?? null;
  // Related sections wait for the warehouse so a 403 or 404 shows one clear error instead of several.
  const isWarehouseLoaded = Boolean(warehouse);

  const stockSummaryQuery = useQuery({
    enabled: isWarehouseLoaded && canReadInventory,
    queryFn: async ({ signal }): Promise<WarehouseStockSummary> => {
      const query = { limit: 1, page: 1, warehouseId };
      const [products, lowStock, nearExpiry] = await Promise.all([
        api.request<PaginatedResponse<InventoryStock>>("/admin/inventory", { query, signal }),
        api.request<PaginatedResponse<InventoryStock>>("/admin/inventory/low-stock", {
          query,
          signal
        }),
        api.request<PaginatedResponse<StockBatch>>("/admin/inventory/near-expiry", {
          query: { ...query, days: WAREHOUSE_NEAR_EXPIRY_DAYS },
          signal
        })
      ]);

      return {
        lowStock: lowStock.pagination.total,
        nearExpiry: nearExpiry.pagination.total,
        products: products.pagination.total
      };
    },
    queryKey: ["admin", "inventory", "warehouse-detail", warehouseId, "summary"]
  });

  const stockQuery = useQuery<PaginatedResponse<InventoryStock>>({
    enabled: isWarehouseLoaded && canReadInventory,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) =>
      api.request<PaginatedResponse<InventoryStock>>("/admin/inventory", {
        query: buildWarehouseStockQuery(warehouseId, productPage, productSearch),
        signal
      }),
    queryKey: ["admin", "inventory", "warehouse-detail", warehouseId, "stock", productPage, productSearch]
  });

  // Shares the staff page's key, so assigning or removing staff there refreshes this list too.
  const staffQuery = useQuery({
    enabled: isWarehouseLoaded && canManageStaff,
    queryFn: ({ signal }) =>
      api.request<WarehouseStaffAssignment[]>(`${warehousePath}/staff`, { signal }),
    queryKey: ["admin", "warehouses", warehouseId, "staff"]
  });

  const partnersQuery = useQuery<DeliveryPaginatedResponse<AdminDeliveryPartner>>({
    enabled: isWarehouseLoaded && canReadDelivery,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) =>
      api.request<DeliveryPaginatedResponse<AdminDeliveryPartner>>("/admin/delivery-partners", {
        query: buildWarehousePartnerQuery(warehouseId, partnerPage),
        signal
      }),
    queryKey: ["admin", "delivery", "warehouse-detail", warehouseId, "partners", partnerPage]
  });

  const detailError = warehouseQuery.isError ? getWarehouseDetailError(warehouseQuery.error) : null;
  const quickLinks = buildWarehouseQuickLinks(warehouseId, hasPermission);
  const stockPage = stockQuery.data ?? null;
  const partnerResults = partnersQuery.data ?? null;
  const partnerTotal = partnerResults
    ? partnerResults.pagination?.total ?? partnerResults.items.length
    : undefined;

  // invalidateQueries refetches only enabled queries; refetch() would ignore missing permissions.
  async function refreshWarehouse() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses", warehouseId] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory", "warehouse-detail", warehouseId] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery", "warehouse-detail", warehouseId] })
    ]);
  }

  function submitProductSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductSearch(normalizeWarehouseProductSearch(productSearchDraft));
    setProductPage(1);
  }

  function clearProductSearch() {
    setProductSearchDraft("");
    setProductSearch("");
    setProductPage(1);
  }

  return (
    <div className="warehouseModule" data-warehouse-view="detail">
      <Card className="panel warehouseDetailPanel">
        <PageHeader
          actions={
            <div className="actionRow warehouseHeaderActions warehouseDetailHeaderActions">
              <Button
                className="iconTextButton"
                onClick={() => void refreshWarehouse()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
              {canManage && warehouse ? (
                <Button asChild className="buttonLink iconTextButton">
                  <Link
                    href={buildWarehouseEditPath(warehouse.id, buildWarehouseDetailPath(warehouse.id))}
                  >
                    <Pencil aria-hidden size={16} />
                    <span>Edit</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          }
          backHref={WAREHOUSES_PATH}
          backLabel="Back to warehouses"
          className="warehousePageHeader warehouseDetailHeader"
          eyebrow={warehouse ? `Warehouse ${warehouse.code}` : "Warehouse"}
          title={warehouse?.name ?? detailError?.title ?? "Loading warehouse"}
        />

        {warehouseQuery.isLoading ? <LoadingState label="Loading warehouse..." /> : null}
        {detailError ? (
          <p className="formError" role="alert">
            {detailError.message}
          </p>
        ) : null}

        {warehouse ? (
          <div className="metricGrid resourceMetrics warehouseMetricGrid warehouseDetailMetricGrid">
            <MetricCard
              label="Status"
              tone={warehouse.status === "ACTIVE" ? "primary" : "warning"}
              value={formatWarehouseStatus(warehouse.status)}
            />
            {canReadInventory ? (
              <>
                <MetricCard
                  label="Products"
                  tone="primary"
                  value={metricValue(stockSummaryQuery, (summary) => summary.products)}
                />
                <MetricCard
                  label="Low stock"
                  tone="warning"
                  value={metricValue(stockSummaryQuery, (summary) => summary.lowStock)}
                />
                <MetricCard
                  label={`Expiring in ${WAREHOUSE_NEAR_EXPIRY_DAYS} days`}
                  tone="warning"
                  value={metricValue(stockSummaryQuery, (summary) => summary.nearExpiry)}
                />
              </>
            ) : null}
            {canManageStaff ? (
              <MetricCard
                label="Assigned staff"
                value={metricValue(staffQuery, (staff) => staff.length)}
              />
            ) : null}
            {canReadDelivery ? (
              <MetricCard
                label="Delivery partners"
                value={
                  partnerTotal ?? (partnersQuery.isError ? "-" : "...")
                }
              />
            ) : null}
          </div>
        ) : null}
      </Card>

      {warehouse ? (
        <>
          <section aria-labelledby="warehouse-detail-profile-title" className="panel warehouseDetailPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Profile</p>
                <h2 id="warehouse-detail-profile-title">Warehouse details</h2>
              </div>
            </div>
            {warehouse.status === "INACTIVE" ? (
              <p className="warehouseDetailNote">
                This warehouse is inactive, so it is not used for new stock operations.
              </p>
            ) : null}
            <div className="detailGrid warehouseDetailGrid">
              <DetailItem label="Code" value={warehouse.code} />
              <DetailItem label="Status" value={<StatusBadge status={warehouse.status} />} />
              <DetailItem label="Contact person" value={warehouse.contactPerson} />
              <DetailItem label="Address" value={warehouse.address} wide />
              <DetailItem label="City" value={warehouse.city} />
              <DetailItem label="State" value={warehouse.state} />
              <DetailItem label="Pincode" value={warehouse.pincode} />
              <DetailItem label="Contact number" value={warehouse.contactNumber} />
              <DetailItem
                label="Coordinates"
                value={formatWarehouseCoordinates(warehouse.latitude, warehouse.longitude)}
              />
              <DetailItem label="Created" value={formatDateTime(String(warehouse.createdAt))} />
              <DetailItem label="Last updated" value={formatDateTime(String(warehouse.updatedAt))} />
              <DetailItem label="Warehouse ID" value={warehouse.id} wide />
            </div>
          </section>

          {quickLinks.length > 0 ? (
            <section aria-labelledby="warehouse-detail-links-title" className="panel warehouseDetailPanel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Shortcuts</p>
                  <h2 id="warehouse-detail-links-title">Jump to</h2>
                </div>
              </div>
              <nav aria-label="Warehouse shortcuts" className="warehouseQuickLinks">
                {quickLinks.map((link) => (
                  <Button asChild key={link.label} variant="outline">
                    <Link href={link.href}>{link.label}</Link>
                  </Button>
                ))}
              </nav>
            </section>
          ) : null}

          <section aria-labelledby="warehouse-detail-products-title" className="panel warehouseDetailPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Inventory</p>
                <h2 id="warehouse-detail-products-title">Products</h2>
              </div>
            </div>
            {canReadInventory ? (
              <>
                <form className="warehouseProductSearch" onSubmit={submitProductSearch} role="search">
                  <Input
                    aria-label="Search products"
                    maxLength={160}
                    onChange={(event) => setProductSearchDraft(event.target.value)}
                    placeholder="Product name or SKU"
                    value={productSearchDraft}
                  />
                  <Button className="iconTextButton" type="submit" variant="outline">
                    <Search aria-hidden size={16} />
                    <span>Search</span>
                  </Button>
                  {productSearch ? (
                    <Button
                      className="iconTextButton"
                      onClick={clearProductSearch}
                      type="button"
                      variant="outline"
                    >
                      <X aria-hidden size={16} />
                      <span>Clear</span>
                    </Button>
                  ) : null}
                </form>
                {stockQuery.isLoading ? <LoadingState label="Loading products..." /> : null}
                {stockQuery.isError ? (
                  <p className="formError" role="alert">
                    {getErrorMessage(stockQuery.error) ?? "Unable to load products."}
                  </p>
                ) : null}
                {stockPage && stockPage.items.length === 0 ? (
                  <EmptyState
                    body={
                      productSearch
                        ? "No products in this warehouse match that name or SKU."
                        : "No products are stocked in this warehouse yet."
                    }
                    title={productSearch ? "No matching products" : "No products yet"}
                  />
                ) : null}
                {stockPage && stockPage.items.length > 0 ? (
                  <>
                    <WarehouseProductsTable
                      canReadProducts={canReadProducts}
                      stocks={stockPage.items}
                      warehouseId={warehouseId}
                    />
                    <PaginationControls
                      ariaLabel="Warehouse products pagination"
                      isPending={stockQuery.isFetching && !stockQuery.isLoading}
                      onChange={setProductPage}
                      page={stockPage.pagination.page}
                      pageSize={stockPage.pagination.limit}
                      totalItems={stockPage.pagination.total}
                      totalPages={stockPage.pagination.totalPages}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState
                body="Viewing this warehouse's products requires the inventory read permission."
                title="Products unavailable"
              />
            )}
          </section>

          <section aria-labelledby="warehouse-detail-staff-title" className="panel warehouseDetailPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">People</p>
                <h2 id="warehouse-detail-staff-title">Staff</h2>
              </div>
              {canManageStaff ? (
                <Button asChild className="iconTextButton" variant="outline">
                  <Link href={buildWarehouseStaffPath(warehouseId)}>
                    <Users aria-hidden size={16} />
                    <span>Manage staff</span>
                  </Link>
                </Button>
              ) : null}
            </div>
            {canManageStaff ? (
              <>
                {staffQuery.isLoading ? <LoadingState label="Loading staff..." /> : null}
                {staffQuery.isError ? (
                  <p className="formError" role="alert">
                    {getErrorMessage(staffQuery.error) ?? "Unable to load staff."}
                  </p>
                ) : null}
                {staffQuery.data && staffQuery.data.length === 0 ? (
                  <EmptyState
                    body="Assign staff so they can see and manage this warehouse."
                    title="No staff assigned"
                  />
                ) : null}
                {staffQuery.data && staffQuery.data.length > 0 ? (
                  <WarehouseDetailStaffTable staff={staffQuery.data} />
                ) : null}
              </>
            ) : (
              <EmptyState
                body="Viewing warehouse staff requires the warehouse staff permission."
                title="Staff unavailable"
              />
            )}
          </section>

          <section aria-labelledby="warehouse-detail-partners-title" className="panel warehouseDetailPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Delivery</p>
                <h2 id="warehouse-detail-partners-title">Delivery partners</h2>
              </div>
            </div>
            {canReadDelivery ? (
              <>
                <p className="warehouseDetailNote">
                  Partners with at least one delivery picked up from this warehouse.
                </p>
                {partnersQuery.isLoading ? <LoadingState label="Loading delivery partners..." /> : null}
                {partnersQuery.isError ? (
                  <p className="formError" role="alert">
                    {getErrorMessage(partnersQuery.error) ?? "Unable to load delivery partners."}
                  </p>
                ) : null}
                {partnerResults && partnerResults.items.length === 0 ? (
                  <EmptyState
                    body="Partners appear here after they are assigned a delivery from this warehouse."
                    title="No delivery partners yet"
                  />
                ) : null}
                {partnerResults && partnerResults.items.length > 0 ? (
                  <>
                    <WarehousePartnersTable partners={partnerResults.items} warehouseId={warehouseId} />
                    {partnerResults.pagination ? (
                      <PaginationControls
                        ariaLabel="Warehouse delivery partners pagination"
                        isPending={partnersQuery.isFetching && !partnersQuery.isLoading}
                        onChange={setPartnerPage}
                        page={partnerResults.pagination.page}
                        pageSize={partnerResults.pagination.limit}
                        totalItems={partnerResults.pagination.total}
                        totalPages={partnerResults.pagination.totalPages}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState
                body="Viewing delivery partners requires the delivery read permission."
                title="Delivery partners unavailable"
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function WarehouseProductsTable({
  canReadProducts,
  stocks,
  warehouseId
}: {
  canReadProducts: boolean;
  stocks: InventoryStock[];
  warehouseId: string;
}) {
  return (
    <div className="resourceTable warehouseTableShell warehouseProductTableShell">
      <p className="warehouseTableHint" id="warehouse-products-table-hint">
        Swipe sideways to view every product column.
      </p>
      <Table
        aria-describedby="warehouse-products-table-hint"
        aria-label="Warehouse products"
        className="warehouseProductDataTable"
        containerClassName="warehouseTableViewport"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Reserved</TableHead>
            <TableHead>Low-stock threshold</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead className="warehouseActionsCell">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => {
            const productName = stock.product?.name ?? stock.productId;
            const productLabel = <strong title={productName}>{productName}</strong>;

            return (
              <TableRow key={stock.id}>
                <TableCell>
                  {canReadProducts ? (
                    <Link className="warehouseNameLink" href={buildProductEditPath(stock.productId)}>
                      {productLabel}
                    </Link>
                  ) : (
                    productLabel
                  )}
                  {stock.product ? <em>{stock.product.sku}</em> : null}
                </TableCell>
                <TableCell>
                  <span className="warehouseCellText">{stock.variant?.name ?? "Base product"}</span>
                  {stock.variant ? <em>{stock.variant.sku}</em> : null}
                </TableCell>
                <TableCell>{stock.availableQuantity}</TableCell>
                <TableCell>{stock.reservedQuantity}</TableCell>
                <TableCell>{stock.lowStockThreshold}</TableCell>
                <TableCell>
                  <StatusBadge status={getStockLevel(stock)} />
                </TableCell>
                <TableCell className="warehouseActionsCell">
                  <span className="tableActions">
                    <Button asChild className="iconTextButton" size="sm" variant="outline">
                      <Link
                        aria-label={`View stock for ${productName}`}
                        href={buildWarehouseScopedHref(INVENTORY_OVERVIEW_PATH, warehouseId, {
                          productId: stock.productId
                        })}
                      >
                        <Package aria-hidden size={16} />
                        <span>Stock</span>
                      </Link>
                    </Button>
                    <Button asChild className="iconTextButton" size="sm" variant="outline">
                      <Link
                        aria-label={`View stock movements for ${productName}`}
                        href={buildWarehouseScopedHref(INVENTORY_MOVEMENTS_PATH, warehouseId, {
                          productId: stock.productId
                        })}
                      >
                        <History aria-hidden size={16} />
                        <span>Movements</span>
                      </Link>
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function WarehouseDetailStaffTable({ staff }: { staff: WarehouseStaffAssignment[] }) {
  const staffPages = useClientPagination(staff);

  return (
    <>
      <div className="resourceTable warehouseTableShell warehouseDetailStaffTableShell">
        <p className="warehouseTableHint" id="warehouse-detail-staff-table-hint">
          Swipe sideways to view every staff detail.
        </p>
        <Table
          aria-describedby="warehouse-detail-staff-table-hint"
          aria-label="Warehouse staff"
          className="warehouseDetailStaffDataTable"
          containerClassName="warehouseTableViewport"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Staff member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffPages.pageItems.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <strong>{[member.firstName, member.lastName].filter(Boolean).join(" ")}</strong>
                </TableCell>
                <TableCell>
                  <span className="warehouseCellText">{member.email}</span>
                </TableCell>
                <TableCell>{member.role?.name ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        ariaLabel="Warehouse staff pagination"
        onChange={staffPages.setPage}
        page={staffPages.page}
        pageSize={staffPages.pageSize}
        totalItems={staffPages.totalItems}
        totalPages={staffPages.totalPages}
      />
    </>
  );
}

function WarehousePartnersTable({
  partners,
  warehouseId
}: {
  partners: AdminDeliveryPartner[];
  warehouseId: string;
}) {
  return (
    <div className="resourceTable warehouseTableShell warehousePartnerTableShell">
      <p className="warehouseTableHint" id="warehouse-partners-table-hint">
        Swipe sideways to view every partner detail.
      </p>
      <Table
        aria-describedby="warehouse-partners-table-hint"
        aria-label="Warehouse delivery partners"
        className="warehousePartnerDataTable"
        containerClassName="warehouseTableViewport"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Partner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead className="warehouseActionsCell">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner) => (
            <TableRow key={partner.id}>
              <TableCell>
                <strong title={partner.fullName}>{partner.fullName}</strong>
                <em>{partner.mobileNumber}</em>
              </TableCell>
              <TableCell>
                <StatusBadge status={partner.status} />
              </TableCell>
              <TableCell>{partner.isOnline ? "Online" : "Offline"}</TableCell>
              <TableCell>{partner.vehicleNumber ?? "-"}</TableCell>
              <TableCell className="warehouseActionsCell">
                <span className="tableActions">
                  <Button asChild className="iconTextButton" size="sm" variant="outline">
                    <Link
                      aria-label={`View ${partner.fullName}`}
                      href={`/delivery/partners/${encodeURIComponent(partner.id)}`}
                    >
                      <Eye aria-hidden size={16} />
                      <span>View</span>
                    </Link>
                  </Button>
                  <Button asChild className="iconTextButton" size="sm" variant="outline">
                    <Link
                      aria-label={`Deliveries by ${partner.fullName} from this warehouse`}
                      href={buildWarehouseScopedHref("/delivery/assignments", warehouseId, {
                        deliveryPartnerId: partner.id
                      })}
                    >
                      <Truck aria-hidden size={16} />
                      <span>Deliveries</span>
                    </Link>
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailItem({
  label,
  value,
  wide = false
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="detailItem" data-wide={wide}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function metricValue<T>(
  query: { data?: T; isError: boolean },
  select: (data: T) => number
) {
  if (query.data !== undefined) {
    return select(query.data);
  }

  return query.isError ? "-" : "...";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
