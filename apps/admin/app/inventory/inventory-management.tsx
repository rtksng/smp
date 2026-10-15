"use client";

import { BulkPageCheckbox, BulkRowCheckbox } from "@/components/admin/bulk-actions";
import { loadBulkRows } from "@/lib/bulk-actions";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import { InventoryBulkActions } from "@/components/admin/inventory-bulk-actions";
import type { BulkInventoryRow } from "@/lib/bulk-resource-actions";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  History,
  MoreVertical,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "../admin-shell";
import {
  PermissionGate,
  ProtectedRoute,
  useAdminSession
} from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import type { AdminProduct, ProductListResponse } from "../../lib/product-form";
import {
  INVENTORY_MOVEMENTS_PATH,
  INVENTORY_TABS,
  MOVEMENT_FILTERS,
  STOCK_ACTIONS,
  STOCK_OUT_REASONS,
  STOCK_OUT_REASON_LABELS,
  buildInventoryRequest,
  buildStockActionHref,
  buildStockCountPayload,
  buildStockInPayload,
  buildStockMovementQuery,
  buildStockOutPayload,
  buildTransferStockPayload,
  createInventoryFiltersFromSearchParams,
  daysUntilExpiry,
  describeMovement,
  formatSignedQuantity,
  formatStockItemName,
  getMovementNetQuantity,
  getStockActionFromSearchParams,
  getStockLevel,
  loadAllPaginatedItems,
  stockCountFormSchema,
  stockInFormSchema,
  stockOutFormSchema,
  transferStockFormSchema,
  type InventoryFilters,
  type InventoryStock,
  type InventorySummary,
  type InventoryView,
  type PaginatedResponse,
  type StockAction,
  type StockBatch,
  type StockMovement,
  type StockOutReason
} from "../../lib/inventory-management";
import type {
  AdminWarehouse,
  WarehouseListResponse
} from "../../lib/warehouse-management";
import "./inventory-management.css";

const INVENTORY_PAGE_SIZE = 20;
const LOOKUP_PAGE_SIZE = 100;
const PRODUCT_SEARCH_LIMIT = 20;
const ALL_WAREHOUSES_VALUE = "__all_warehouses__";
const NO_VARIANT_VALUE = "__base_product__";
const NEAR_EXPIRY_DAYS = 30;

type StockLevelsView = "all" | "restock" | "low" | "out" | "expiring";
type FieldErrors = Record<string, string | undefined>;

const VIEW_TITLES: Record<InventoryView, string> = {
  actions: "Stock actions",
  movements: "Movement log",
  overview: "Stock levels"
};

const STOCK_VIEW_TITLES: Record<StockLevelsView, string> = {
  all: "All stock lines",
  expiring: `Batches expiring within ${NEAR_EXPIRY_DAYS} days`,
  low: "Low stock",
  out: "Out of stock",
  restock: "Needs restock"
};

const STOCK_VIEW_HINTS: Record<StockLevelsView, string> = {
  all: "Every product and variant held in the warehouses in view.",
  expiring: "Batches with units left that expire soon. Remove expired units so they are not sold.",
  low: "Some units left, but at or below the low-stock threshold.",
  out: "No units available to sell.",
  restock: "Low or out of stock: everything at or below its threshold."
};

export function InventoryManagementPage({ view }: { view: InventoryView }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.InventoryRead}>
        <InventoryContent view={view} />
      </ProtectedRoute>
    </AdminShell>
  );
}

function InventoryContent({ view }: { view: InventoryView }) {
  const { api, hasPermission, isSuperAdmin } = useAdminSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const urlParams = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const urlFilters = useMemo(() => createInventoryFiltersFromSearchParams(urlParams), [urlParams]);
  const [filters, setFilters] = useState<InventoryFilters>(urlFilters);
  const canReadWarehouses = hasPermission(ADMIN_PERMISSION.WarehouseRead);

  useEffect(() => {
    setFilters(urlFilters);
  }, [urlFilters]);

  // The API lists every warehouse for the super admin and only assigned ones for everyone else.
  const warehousesQuery = useQuery({
    enabled: canReadWarehouses,
    queryFn: () =>
      loadAllPaginatedItems<AdminWarehouse>((page) =>
        api.request<WarehouseListResponse>("/admin/warehouses", {
          query: { limit: LOOKUP_PAGE_SIZE, page }
        })
      ),
    queryKey: ["admin", "inventory", "warehouses"],
    staleTime: 5 * 60_000
  });
  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const showWarehouseColumn = Boolean(isSuperAdmin) || warehouses.length !== 1;

  async function refreshInventory() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
  }

  return (
    <div className="inventoryModule" data-inventory-view={view}>
      <Card className="panel inventoryHeroPanel">
        <PageHeader
          actions={
            <Button
              className="iconTextButton"
              onClick={() => void refreshInventory()}
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden size={16} />
              <span>Refresh</span>
            </Button>
          }
          className="inventoryPageHeader"
          eyebrow="Inventory"
          level={2}
          title={VIEW_TITLES[view]}
        />
        <div className="inventoryContextBar">
          <InventorySubTabs activeView={view} warehouseId={filters.warehouseId} />
          <WarehouseContextPicker
            canReadWarehouses={canReadWarehouses}
            isLoading={warehousesQuery.isLoading}
            isSuperAdmin={Boolean(isSuperAdmin)}
            onChange={(warehouseId) => setFilters((current) => ({ ...current, warehouseId }))}
            value={filters.warehouseId}
            warehouses={warehouses}
          />
        </div>
        {warehousesQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
          </p>
        ) : null}
        {view === "overview" ? (
          <StockSummaryTiles
            filters={filters}
            onSelect={(stockView) => setFilters((current) => withStockView(current, stockView))}
          />
        ) : null}
      </Card>

      {view === "overview" ? (
        <StockLevelsPanel
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={refreshInventory}
          showWarehouseColumn={showWarehouseColumn}
          warehouses={warehouses}
        />
      ) : null}

      {view === "actions" ? (
        <PermissionGate
          fallback={
            <EmptyState
              body="Your admin role can view stock but cannot change it."
              title="Stock actions unavailable"
            />
          }
          permission={ADMIN_PERMISSION.InventoryUpdate}
        >
          <StockActionsPanel
            initialAction={getStockActionFromSearchParams(urlParams.get("action"))}
            initialBatchNumber={urlParams.get("batchNumber") ?? ""}
            initialProductId={urlFilters.productId}
            initialReason={urlParams.get("reason")}
            initialVariantId={urlParams.get("variantId") ?? ""}
            isSuperAdmin={Boolean(isSuperAdmin)}
            onRefresh={refreshInventory}
            warehouseId={filters.warehouseId}
            warehouses={warehouses}
          />
        </PermissionGate>
      ) : null}

      {view === "movements" ? (
        <MovementLogPanel
          filters={filters}
          onFiltersChange={setFilters}
          showWarehouseColumn={showWarehouseColumn}
        />
      ) : null}
    </div>
  );
}

function InventorySubTabs({
  activeView,
  warehouseId
}: {
  activeView: InventoryView;
  warehouseId: string;
}) {
  return (
    <nav aria-label="Inventory sections" className="inventorySubTabs">
      {INVENTORY_TABS.map((tab) => (
        <Link
          aria-current={activeView === tab.value ? "page" : undefined}
          className="inventorySubTab"
          href={warehouseId ? `${tab.href}?warehouseId=${encodeURIComponent(warehouseId)}` : tab.href}
          key={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** One place to choose the warehouse every inventory view works in. */
function WarehouseContextPicker({
  canReadWarehouses,
  isLoading,
  isSuperAdmin,
  onChange,
  value,
  warehouses
}: {
  canReadWarehouses: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  onChange: (warehouseId: string) => void;
  value: string;
  warehouses: AdminWarehouse[];
}) {
  if (!canReadWarehouses) {
    return null;
  }

  if (!isSuperAdmin && warehouses.length === 1) {
    return (
      <p className="inventoryWarehouseChip">
        <span>Warehouse</span>
        <strong>
          {warehouses[0]!.name} ({warehouses[0]!.code})
        </strong>
      </p>
    );
  }

  return (
    <div className="inventoryWarehousePicker">
      <Select
        aria-label="Warehouse"
        disabled={isLoading}
        onValueChange={(nextValue) => onChange(nextValue === ALL_WAREHOUSES_VALUE ? "" : nextValue)}
        value={value || ALL_WAREHOUSES_VALUE}
      >
        <SelectTrigger>
          <SelectValue placeholder="All warehouses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_WAREHOUSES_VALUE}>
            {isSuperAdmin ? "All warehouses" : "All my warehouses"}
          </SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getStockView(filters: InventoryFilters): StockLevelsView {
  if (filters.nearExpiry) return "expiring";
  if (filters.lowStock) return "restock";
  if (filters.stockStatus === "LOW_STOCK") return "low";
  if (filters.stockStatus === "OUT_OF_STOCK") return "out";

  return "all";
}

function withStockView(filters: InventoryFilters, stockView: StockLevelsView): InventoryFilters {
  return {
    ...filters,
    lowStock: stockView === "restock",
    nearExpiry: stockView === "expiring",
    nearExpiryDays: String(NEAR_EXPIRY_DAYS),
    stockStatus: stockView === "low" ? "LOW_STOCK" : stockView === "out" ? "OUT_OF_STOCK" : ""
  };
}

function StockSummaryTiles({
  filters,
  onSelect
}: {
  filters: InventoryFilters;
  onSelect: (stockView: StockLevelsView) => void;
}) {
  const { api } = useAdminSession();
  const summaryQuery = useQuery({
    queryFn: ({ signal }) =>
      api.request<InventorySummary>("/admin/inventory/summary", {
        query: { days: NEAR_EXPIRY_DAYS, warehouseId: filters.warehouseId || undefined },
        signal
      }),
    queryKey: ["admin", "inventory", "summary", filters.warehouseId]
  });
  const summary = summaryQuery.data;
  const activeView = getStockView(filters);
  const count = (select: (value: InventorySummary) => number) =>
    summary ? select(summary).toLocaleString("en-IN") : summaryQuery.isError ? "-" : "...";
  const tiles: Array<{
    hint: string;
    label: string;
    tone: "neutral" | "primary" | "warning";
    value: string;
    view: StockLevelsView;
  }> = [
    { hint: "Product and variant lines", label: "All stock lines", tone: "primary", value: count((s) => s.trackedItems), view: "all" },
    { hint: "Low or out of stock", label: "Needs restock", tone: "warning", value: count((s) => s.lowStockItems + s.outOfStockItems), view: "restock" },
    { hint: "At or below threshold", label: "Low stock", tone: "warning", value: count((s) => s.lowStockItems), view: "low" },
    { hint: "Nothing left to sell", label: "Out of stock", tone: "warning", value: count((s) => s.outOfStockItems), view: "out" },
    { hint: `Batches within ${NEAR_EXPIRY_DAYS} days`, label: "Expiring soon", tone: "warning", value: count((s) => s.nearExpiryBatches), view: "expiring" }
  ];

  return (
    <>
      <div aria-label="Stock summary" className="inventoryTiles" role="group">
        {tiles.map((tile) => (
          <button
            aria-pressed={activeView === tile.view}
            className="inventoryTile"
            data-tone={tile.tone}
            key={tile.view}
            onClick={() => onSelect(tile.view)}
            type="button"
          >
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            <em>{tile.hint}</em>
          </button>
        ))}
      </div>
      {summary ? (
        <p className="inventorySummaryLine">
          {summary.assignedProducts.toLocaleString("en-IN")} products assigned ·{" "}
          {summary.availableUnits.toLocaleString("en-IN")} units available ·{" "}
          {summary.reservedUnits.toLocaleString("en-IN")} reserved for open orders
        </p>
      ) : null}
    </>
  );
}

function StockLevelsPanel({
  filters,
  onFiltersChange,
  onRefresh,
  showWarehouseColumn,
  warehouses
}: {
  filters: InventoryFilters;
  onFiltersChange: (filters: InventoryFilters) => void;
  onRefresh: () => Promise<void>;
  showWarehouseColumn: boolean;
  warehouses: AdminWarehouse[];
}) {
  const { api, hasPermission } = useAdminSession();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const stockView = getStockView(filters);
  const request = useMemo(
    () => buildInventoryRequest(filters, { limit: INVENTORY_PAGE_SIZE, page }),
    [filters, page]
  );
  const listQuery = useQuery<PaginatedResponse<InventoryStock> | PaginatedResponse<StockBatch>>({
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) =>
      api.request<PaginatedResponse<InventoryStock> | PaginatedResponse<StockBatch>>(
        request.endpoint,
        { query: request.query, signal }
      ),
    queryKey: ["admin", "inventory", "list", request]
  });
  const canUpdate = hasPermission(ADMIN_PERMISSION.InventoryUpdate);
  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const bulk = useBulkSelection<BulkInventoryRow>(JSON.stringify(filters), items);
  const pagination = listQuery.data?.pagination;
  const filterScope = JSON.stringify({ ...filters, search: "" });

  useEffect(() => {
    setPage(1);
  }, [filterScope]);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (pagination && page > Math.max(pagination.totalPages, 1)) {
      setPage(Math.max(pagination.totalPages, 1));
    }
  }, [page, pagination]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = searchDraft.trim().slice(0, 160);

    setPage(1);
    onFiltersChange({ ...filters, search });
  }

  const rowLabel = (row: BulkInventoryRow) =>
    [formatStockItemName(row), row.warehouse?.name ?? warehouseName(warehouses, row.warehouseId), "batchNumber" in row ? row.batchNumber : ""]
      .filter(Boolean)
      .join(" / ");

  return (
    <Card className="panel mt-3 inventorySectionPanel inventoryTablePanel">
      <PageHeader
        actions={
          canUpdate ? (
            <Button asChild className="iconTextButton">
              <Link href={buildStockActionHref("receive", { warehouseId: filters.warehouseId })}>
                <PackagePlus aria-hidden size={16} />
                <span>Receive stock</span>
              </Link>
            </Button>
          ) : null
        }
        className="inventorySectionHeader"
        eyebrow="Stock levels"
        level={2}
        title={STOCK_VIEW_TITLES[stockView]}
      />
      <p className="inventoryViewHint">{STOCK_VIEW_HINTS[stockView]}</p>
      <div className="inventoryToolbar">
        <form className="inventorySearchForm" onSubmit={submitSearch} role="search">
          <span className="searchInput">
            <Search aria-hidden size={16} />
            <Input
              aria-label="Search stock by product name or SKU"
              maxLength={160}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by product name or SKU"
              value={searchDraft}
            />
          </span>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <ActiveInventoryFilters filters={filters} onChange={onFiltersChange} />
      </div>

      {listQuery.isLoading ? <LoadingState label="Loading stock..." /> : null}
      {listQuery.isError ? (
        <p className="formError" role="alert">
          {getErrorMessage(listQuery.error) ?? "Unable to load stock."}
        </p>
      ) : null}
      {canUpdate ? (
        <InventoryBulkActions
          disabled={listQuery.isFetching || listQuery.isError}
          getLabel={rowLabel}
          key={bulk.scope}
          loadAll={() =>
            loadBulkRows((next, limit) => {
              const allRequest = buildInventoryRequest(filters, { limit, page: next });
              return api.request<PaginatedResponse<BulkInventoryRow>>(allRequest.endpoint, {
                query: allRequest.query
              });
            })
          }
          onComplete={onRefresh}
          selection={bulk}
          total={pagination?.total ?? 0}
          warehouses={warehouses}
        />
      ) : null}
      {!listQuery.isLoading && !listQuery.isError ? (
        request.type === "batch" ? (
          <BatchTable
            batches={items as StockBatch[]}
            bulk={canUpdate ? bulk : undefined}
            canUpdate={canUpdate}
            rowLabel={rowLabel}
            showWarehouseColumn={showWarehouseColumn}
            warehouses={warehouses}
          />
        ) : (
          <StockTable
            bulk={canUpdate ? bulk : undefined}
            canUpdate={canUpdate}
            rowLabel={rowLabel}
            showWarehouseColumn={showWarehouseColumn}
            stocks={items as InventoryStock[]}
            warehouses={warehouses}
          />
        )
      ) : null}
      {pagination ? (
        <PaginationControls
          isPending={listQuery.isFetching && !listQuery.isLoading}
          onChange={(next) => {
            if (!bulk.isBusy) setPage(next);
          }}
          page={pagination.page}
          pageSize={pagination.limit}
          totalItems={pagination.total}
          totalPages={pagination.totalPages}
        />
      ) : null}
    </Card>
  );
}

/** Shows filters that came from a link, such as one product's stock, with a way to clear them. */
function ActiveInventoryFilters({
  filters,
  onChange
}: {
  filters: InventoryFilters;
  onChange: (filters: InventoryFilters) => void;
}) {
  type FilterChip = { change: Partial<InventoryFilters>; label: string };
  const chips: FilterChip[] = [];

  if (filters.search) {
    chips.push({ change: { search: "" }, label: `Search: ${filters.search}` });
  }
  if (filters.productId) {
    chips.push({ change: { productId: "" }, label: "One product only" });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div aria-label="Active filters" className="inventoryActiveFilters" role="group">
      {chips.map((chip) => (
        <button
          aria-label={`Remove filter ${chip.label}`}
          className="inventoryFilterChip"
          key={chip.label}
          onClick={() => onChange({ ...filters, ...chip.change })}
          type="button"
        >
          <span>{chip.label}</span>
          <X aria-hidden size={13} />
        </button>
      ))}
    </div>
  );
}

function StockTable({
  bulk,
  canUpdate,
  rowLabel,
  showWarehouseColumn,
  stocks,
  warehouses
}: {
  bulk?: BulkSelection<BulkInventoryRow>;
  canUpdate: boolean;
  rowLabel: (row: BulkInventoryRow) => string;
  showWarehouseColumn: boolean;
  stocks: InventoryStock[];
  warehouses: AdminWarehouse[];
}) {
  if (stocks.length === 0) {
    return (
      <EmptyState
        body="No stock lines match this view. Products appear here once stock is received into a warehouse they are assigned to."
        title="No stock lines found"
      />
    );
  }

  return (
    <div className="inventoryTableShell">
      <p className="inventoryTableHint">Swipe sideways to view every stock column.</p>
      <div className="brandTableScroll inventoryTableScroll">
        <Table
          aria-label="Stock levels"
          className={`brandDataTable inventoryDataTable${bulk ? " inventoryDataTableWithBulk" : ""}`}
        >
          <TableHeader>
            <TableRow>
              {bulk ? (
                <TableHead className="bulkCheckboxCell">
                  <BulkPageCheckbox selection={bulk} />
                </TableHead>
              ) : null}
              <TableHead>Product</TableHead>
              {showWarehouseColumn ? <TableHead>Warehouse</TableHead> : null}
              <TableHead>Available</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Low-stock threshold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="inventoryActionsCell">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((stock) => {
              const status = stock.stockStatus ?? getStockLevel(stock);

              return (
                <TableRow key={stock.id}>
                  {bulk ? (
                    <TableCell className="bulkCheckboxCell">
                      <BulkRowCheckbox item={stock} label={rowLabel(stock)} selection={bulk} />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <strong>{formatStockItemName(stock)}</strong>
                    <span className="tableSubtext">
                      {stock.variant?.sku ?? stock.product?.sku ?? "SKU unavailable"}
                    </span>
                  </TableCell>
                  {showWarehouseColumn ? (
                    <TableCell>{stock.warehouse?.name ?? warehouseName(warehouses, stock.warehouseId)}</TableCell>
                  ) : null}
                  <TableCell>
                    <strong>{stock.availableQuantity.toLocaleString("en-IN")}</strong>
                  </TableCell>
                  <TableCell>{stock.reservedQuantity.toLocaleString("en-IN")}</TableCell>
                  <TableCell>{stock.lowStockThreshold.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <StatusBadge status={status} />
                  </TableCell>
                  <TableCell className="inventoryActionsCell">
                    <StockRowActions
                      canUpdate={canUpdate}
                      label={formatStockItemName(stock)}
                      params={{
                        productId: stock.productId,
                        variantId: stock.variantId,
                        warehouseId: stock.warehouseId
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BatchTable({
  batches,
  bulk,
  canUpdate,
  rowLabel,
  showWarehouseColumn,
  warehouses
}: {
  batches: StockBatch[];
  bulk?: BulkSelection<BulkInventoryRow>;
  canUpdate: boolean;
  rowLabel: (row: BulkInventoryRow) => string;
  showWarehouseColumn: boolean;
  warehouses: AdminWarehouse[];
}) {
  if (batches.length === 0) {
    return (
      <EmptyState
        body={`No batches with units left expire within ${NEAR_EXPIRY_DAYS} days.`}
        title="Nothing expiring soon"
      />
    );
  }

  return (
    <div className="inventoryTableShell">
      <p className="inventoryTableHint">Swipe sideways to view every batch column.</p>
      <div className="brandTableScroll inventoryTableScroll">
        <Table
          aria-label="Expiring batches"
          className={`brandDataTable inventoryDataTable${bulk ? " inventoryDataTableWithBulk" : ""}`}
        >
          <TableHeader>
            <TableRow>
              {bulk ? (
                <TableHead className="bulkCheckboxCell">
                  <BulkPageCheckbox selection={bulk} />
                </TableHead>
              ) : null}
              <TableHead>Batch</TableHead>
              <TableHead>Product</TableHead>
              {showWarehouseColumn ? <TableHead>Warehouse</TableHead> : null}
              <TableHead>Units left</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Selling price / MRP</TableHead>
              <TableHead className="inventoryActionsCell">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => {
              const daysLeft = daysUntilExpiry(batch.expiryDate);

              return (
                <TableRow key={batch.id}>
                  {bulk ? (
                    <TableCell className="bulkCheckboxCell">
                      <BulkRowCheckbox item={batch} label={batch.batchNumber} selection={bulk} />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <strong>{batch.batchNumber}</strong>
                  </TableCell>
                  <TableCell>
                    {formatStockItemName(batch)}
                    {batch.product ? <span className="tableSubtext">{batch.product.sku}</span> : null}
                  </TableCell>
                  {showWarehouseColumn ? (
                    <TableCell>{batch.warehouse?.name ?? warehouseName(warehouses, batch.warehouseId)}</TableCell>
                  ) : null}
                  <TableCell>{batch.quantity.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <span className="inventoryExpiryCell">
                      <span>{formatDate(batch.expiryDate)}</span>
                      {daysLeft !== null ? (
                        <b data-urgent={daysLeft <= 7 ? "true" : undefined}>
                          {daysLeft <= 0 ? "Expired" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
                        </b>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(batch.sellingPrice)} / {formatCurrency(batch.mrp)}
                  </TableCell>
                  <TableCell className="inventoryActionsCell">
                    <StockRowActions
                      canUpdate={canUpdate}
                      label={`${rowLabel(batch)}`}
                      params={{
                        batchNumber: batch.batchNumber,
                        productId: batch.productId,
                        reason: "EXPIRED",
                        variantId: batch.variantId,
                        warehouseId: batch.warehouseId
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StockRowActions({
  canUpdate,
  label,
  params
}: {
  canUpdate: boolean;
  label: string;
  params: {
    batchNumber?: string;
    productId: string;
    reason?: StockOutReason;
    variantId: string | null;
    warehouseId: string;
  };
}) {
  const historyHref = `${INVENTORY_MOVEMENTS_PATH}?${new URLSearchParams({
    productId: params.productId,
    warehouseId: params.warehouseId
  }).toString()}`;

  if (!canUpdate) {
    return (
      <Button asChild className="iconTextButton" size="sm" variant="outline">
        <Link aria-label={`History for ${label}`} href={historyHref}>
          <History aria-hidden size={15} />
          <span>History</span>
        </Link>
      </Button>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button aria-label={`Stock actions for ${label}`} size="icon" type="button" variant="ghost">
          <MoreVertical aria-hidden size={16} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label={`Stock actions for ${label}`}>
        <DropdownItem as={Link} href={buildStockActionHref("receive", params)} key="receive" startContent={<PackagePlus aria-hidden size={15} />}>
          Receive stock
        </DropdownItem>
        <DropdownItem as={Link} href={buildStockActionHref("remove", params)} key="remove" startContent={<PackageMinus aria-hidden size={15} />}>
          Remove stock
        </DropdownItem>
        <DropdownItem as={Link} href={buildStockActionHref("count", params)} key="count" startContent={<ClipboardCheck aria-hidden size={15} />}>
          Correct a count
        </DropdownItem>
        <DropdownItem as={Link} href={buildStockActionHref("transfer", params)} key="transfer" startContent={<ArrowRightLeft aria-hidden size={15} />}>
          Transfer stock
        </DropdownItem>
        <DropdownItem as={Link} href={historyHref} key="history" startContent={<History aria-hidden size={15} />}>
          View history
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

type ActionValues = {
  batchNumber: string;
  countedQuantity: string;
  expiryDate: string;
  lowStockThreshold: string;
  mrp: string;
  notes: string;
  purchasePrice: string;
  quantity: string;
  reason: string;
  sellingPrice: string;
  stockOutReason: "" | StockOutReason;
  toWarehouseId: string;
};

function createEmptyActionValues(batchNumber = "", stockOutReason: "" | StockOutReason = ""): ActionValues {
  return {
    batchNumber,
    countedQuantity: "",
    expiryDate: "",
    lowStockThreshold: "",
    mrp: "",
    notes: "",
    purchasePrice: "",
    quantity: "",
    reason: "Physical stock count",
    sellingPrice: "",
    stockOutReason,
    toWarehouseId: ""
  };
}

/**
 * One action at a time: pick the warehouse and product once, see what is on hand,
 * then fill in only what that action needs.
 */
function StockActionsPanel({
  initialAction,
  initialBatchNumber,
  initialProductId,
  initialReason,
  initialVariantId,
  isSuperAdmin,
  onRefresh,
  warehouseId: contextWarehouseId,
  warehouses
}: {
  initialAction: StockAction;
  initialBatchNumber: string;
  initialProductId: string;
  initialReason: string | null;
  initialVariantId: string;
  isSuperAdmin: boolean;
  onRefresh: () => Promise<void>;
  warehouseId: string;
  warehouses: AdminWarehouse[];
}) {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const initialStockOutReason = (STOCK_OUT_REASONS as readonly string[]).includes(initialReason ?? "")
    ? (initialReason as StockOutReason)
    : "";
  const [action, setAction] = useState<StockAction>(initialAction);
  const [warehouseId, setWarehouseId] = useState(contextWarehouseId);
  const [productId, setProductId] = useState(initialProductId);
  const [variantId, setVariantId] = useState(initialVariantId);
  const [productSearch, setProductSearch] = useState("");
  const [values, setValues] = useState<ActionValues>(() =>
    createEmptyActionValues(initialBatchNumber, initialStockOutReason)
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "ACTIVE");
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId) ?? null;

  useEffect(() => {
    setAction(initialAction);
  }, [initialAction]);

  useEffect(() => {
    if (contextWarehouseId) {
      setWarehouseId(contextWarehouseId);
    }
  }, [contextWarehouseId]);

  // Someone who runs one warehouse always works in it.
  useEffect(() => {
    if (!warehouseId && !isSuperAdmin && activeWarehouses.length === 1) {
      setWarehouseId(activeWarehouses[0]!.id);
    }
  }, [activeWarehouses, isSuperAdmin, warehouseId]);

  // Products offered are only those assigned to the chosen warehouse.
  const productsQuery = useQuery<ProductListResponse>({
    enabled: Boolean(warehouseId),
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) =>
      api.request<ProductListResponse>("/admin/products", {
        query: {
          limit: PRODUCT_SEARCH_LIMIT,
          page: 1,
          search: productSearch.trim() || undefined,
          sort: "name_az",
          warehouseId
        },
        signal
      }),
    queryKey: ["admin", "inventory", "action-products", warehouseId, productSearch.trim()]
  });
  const productDetailQuery = useQuery({
    enabled: Boolean(productId),
    queryFn: ({ signal }) =>
      api.request<AdminProduct>(`/admin/products/${encodeURIComponent(productId)}`, { signal }),
    queryKey: ["admin", "inventory", "action-product", productId]
  });
  const product = productDetailQuery.data ?? null;
  const isProductInWarehouse = Boolean(
    product && warehouseId && (product.warehouseIds ?? []).includes(warehouseId)
  );
  const stockLineQuery = useQuery({
    enabled: Boolean(productId && warehouseId),
    queryFn: ({ signal }) =>
      api.request<PaginatedResponse<InventoryStock>>("/admin/inventory", {
        query: { limit: 100, page: 1, productId, warehouseId },
        signal
      }),
    queryKey: ["admin", "inventory", "action-stock", warehouseId, productId]
  });
  const stockLine =
    stockLineQuery.data?.items.find((item) => (item.variantId ?? "") === variantId) ?? null;
  const batchesQuery = useQuery({
    enabled: Boolean(productId && warehouseId),
    queryFn: ({ signal }) =>
      api.request<StockBatch[]>("/admin/inventory/batches", {
        query: { includeEmpty: true, productId, variantId: variantId || undefined, warehouseId },
        signal
      }),
    queryKey: ["admin", "inventory", "action-batches", warehouseId, productId, variantId]
  });
  const allBatches = batchesQuery.data ?? [];
  const batchesWithStock = allBatches.filter((batch) => batch.quantity > 0);
  const selectedBatch = allBatches.find((batch) => batch.batchNumber === values.batchNumber) ?? null;
  const transferDestinations = (product?.warehouses ?? []).filter(
    (warehouse) => warehouse.id !== warehouseId && warehouse.status === "ACTIVE"
  );

  const mutation = useMutation({
    mutationFn: ({ body, path }: { body: unknown; path: string }) =>
      api.request(path, { body: JSON.stringify(body), method: "POST" })
  });

  function updateValue<Key extends keyof ActionValues>(key: Key, value: ActionValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function chooseAction(nextAction: StockAction) {
    setAction(nextAction);
    setErrors({});
    setFormError(null);
    setMessage(null);
    setValues((current) => ({
      ...createEmptyActionValues(nextAction === "receive" ? "" : current.batchNumber),
      notes: current.notes
    }));
  }

  function chooseWarehouse(nextWarehouseId: string) {
    setWarehouseId(nextWarehouseId);
    setVariantId("");
    setValues(createEmptyActionValues());
    setErrors({});
    setMessage(null);
  }

  function chooseProduct(nextProductId: string) {
    setProductId(nextProductId);
    setVariantId("");
    setValues(createEmptyActionValues());
    setErrors({});
    setMessage(null);
  }

  // Receiving fills prices from the product and the threshold from the current stock line.
  useEffect(() => {
    if (action !== "receive" || !product) {
      return;
    }

    const variant = product.variants.find((item) => item.id === variantId);

    setValues((current) => ({
      ...current,
      lowStockThreshold: current.lowStockThreshold || String(stockLine?.lowStockThreshold ?? 0),
      mrp: current.mrp || String(variant?.mrp ?? product.mrp),
      sellingPrice: current.sellingPrice || String(variant?.sellingPrice ?? product.sellingPrice)
    }));
  }, [action, product, stockLine?.lowStockThreshold, variantId]);

  const base = { productId, variantId, warehouseId };
  const itemName = product
    ? formatStockItemName({
        product,
        productId,
        variant: product.variants.find((item) => item.id === variantId) ?? null
      })
    : "this product";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

    if (action === "receive") {
      const parsed = stockInFormSchema.safeParse({ ...base, ...pick(values, ["batchNumber", "expiryDate", "lowStockThreshold", "mrp", "notes", "purchasePrice", "quantity", "sellingPrice"]) });

      if (!parsed.success) return setErrors(getFieldErrors(parsed.error));
      if (product?.expirySensitive && !parsed.data.expiryDate) {
        return setErrors({ expiryDate: "This product is expiry tracked, so the batch needs an expiry date." });
      }

      return confirm({
        body: `Receive ${parsed.data.quantity} units of ${itemName} into ${selectedWarehouse?.name ?? "the warehouse"} under batch ${parsed.data.batchNumber.trim()}?`,
        confirmLabel: "Receive stock",
        path: "/admin/inventory/stock-in",
        payload: buildStockInPayload(parsed.data),
        success: `Received ${parsed.data.quantity} units of ${itemName}.`,
        title: "Confirm stock received"
      });
    }

    if (action === "remove") {
      const parsed = stockOutFormSchema.safeParse({ ...base, batchNumber: values.batchNumber, notes: values.notes, quantity: values.quantity, reason: values.stockOutReason });

      if (!parsed.success) return setErrors(getFieldErrors(parsed.error, { reason: "stockOutReason" }));
      if (selectedBatch && Number(parsed.data.quantity) > selectedBatch.quantity) {
        return setErrors({ quantity: `Batch ${selectedBatch.batchNumber} has only ${selectedBatch.quantity} units.` });
      }

      return confirm({
        body: `Remove ${parsed.data.quantity} units of ${itemName} from batch ${parsed.data.batchNumber} (${STOCK_OUT_REASON_LABELS[parsed.data.reason].toLowerCase()})?`,
        confirmLabel: "Remove stock",
        path: "/admin/inventory/stock-out",
        payload: buildStockOutPayload(parsed.data),
        success: `Removed ${parsed.data.quantity} units of ${itemName}.`,
        title: "Confirm stock removal"
      });
    }

    if (action === "count") {
      const parsed = stockCountFormSchema.safeParse({ ...base, batchNumber: values.batchNumber, countedQuantity: values.countedQuantity, lowStockThreshold: values.lowStockThreshold, reason: values.reason });

      if (!parsed.success) return setErrors(getFieldErrors(parsed.error));
      if (!selectedBatch) return setErrors({ batchNumber: "Choose the batch you counted." });

      const payload = buildStockCountPayload(parsed.data, selectedBatch.quantity);

      if (!payload) {
        return setFormError(`Batch ${selectedBatch.batchNumber} already shows ${selectedBatch.quantity} units, so there is nothing to correct.`);
      }

      return confirm({
        body: `Change batch ${selectedBatch.batchNumber} of ${itemName} from ${selectedBatch.quantity} to ${parsed.data.countedQuantity} units (${formatSignedQuantity(payload.quantityDelta)})?`,
        confirmLabel: "Save count",
        path: "/admin/inventory/adjust",
        payload,
        success: `Batch ${selectedBatch.batchNumber} now shows ${parsed.data.countedQuantity} units.`,
        title: "Confirm count correction"
      });
    }

    const parsed = transferStockFormSchema.safeParse({
      batchNumber: values.batchNumber,
      fromWarehouseId: warehouseId,
      notes: values.notes,
      productId,
      quantity: values.quantity,
      toWarehouseId: values.toWarehouseId,
      variantId
    });

    if (!parsed.success) return setErrors(getFieldErrors(parsed.error));
    if (selectedBatch && Number(parsed.data.quantity) > selectedBatch.quantity) {
      return setErrors({ quantity: `Batch ${selectedBatch.batchNumber} has only ${selectedBatch.quantity} units.` });
    }

    const destination = transferDestinations.find((warehouse) => warehouse.id === parsed.data.toWarehouseId);

    return confirm({
      body: `Move ${parsed.data.quantity} units of ${itemName} from ${selectedWarehouse?.name ?? "this warehouse"} to ${destination?.name ?? "the destination"}?`,
      confirmLabel: "Transfer stock",
      path: "/admin/inventory/transfer",
      payload: buildTransferStockPayload(parsed.data),
      success: `Moved ${parsed.data.quantity} units of ${itemName} to ${destination?.name ?? "the destination"}.`,
      title: "Confirm stock transfer"
    });
  }

  function confirm(input: {
    body: string;
    confirmLabel: string;
    path: string;
    payload: unknown;
    success: string;
    title: string;
  }) {
    setErrors({});
    setConfirmation({
      body: input.body,
      confirmLabel: input.confirmLabel,
      onConfirm: async () => {
        await mutation.mutateAsync({ body: input.payload, path: input.path });
        setMessage(input.success);
        setValues((current) => ({
          ...createEmptyActionValues(action === "receive" ? "" : current.batchNumber, current.stockOutReason),
          reason: current.reason
        }));
        await Promise.all([
          onRefresh(),
          queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] })
        ]);
      },
      title: input.title
    });
  }

  const productOptions = productsQuery.data?.items ?? [];
  const productChoices =
    product && !productOptions.some((item) => item.id === product.id) && isProductInWarehouse
      ? [product, ...productOptions]
      : productOptions;
  const ready = Boolean(warehouseId && productId && product && isProductInWarehouse);

  return (
    <Card className="panel mt-3 inventorySectionPanel inventoryActionsPanel">
      <div aria-label="Choose a stock action" className="inventoryActionPicker" role="radiogroup">
        {STOCK_ACTIONS.map((option) => (
          <button
            aria-checked={action === option.value}
            className="inventoryActionOption"
            key={option.value}
            onClick={() => chooseAction(option.value)}
            role="radio"
            type="button"
          >
            <span className="inventoryActionIcon" aria-hidden>
              {ACTION_ICONS[option.value]}
            </span>
            <span>
              <strong>{option.label}</strong>
              <em>{option.description}</em>
            </span>
          </button>
        ))}
      </div>

      {message ? (
        <p className="formSuccess inventoryActionSuccess" role="status">
          <CheckCircle2 aria-hidden size={16} />
          <span>{message}</span>
          <Link href={`${INVENTORY_MOVEMENTS_PATH}?${new URLSearchParams({ productId, warehouseId }).toString()}`}>
            View in movement log
          </Link>
        </p>
      ) : null}

      <form className="inventoryActionForm" noValidate onSubmit={handleSubmit}>
        <fieldset className="inventoryActionStep">
          <legend>1. What are you working with?</legend>
          <div className="formGrid inventoryActionGrid">
            <Label>
              {action === "transfer" ? "From warehouse" : "Warehouse"}
              <Select
                aria-label={action === "transfer" ? "From warehouse" : "Warehouse"}
                disabled={activeWarehouses.length === 0}
                onValueChange={chooseWarehouse}
                value={warehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <div className="inventoryProductPicker">
              <Label>
                Find product
                <span className="searchInput">
                  <Search aria-hidden size={16} />
                  <Input
                    aria-label="Find product by name or SKU"
                    disabled={!warehouseId}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder={warehouseId ? "Name or SKU" : "Choose a warehouse first"}
                    value={productSearch}
                  />
                </span>
              </Label>
              <Label>
                Product
                <Select
                  aria-label="Product"
                  disabled={!warehouseId}
                  onValueChange={chooseProduct}
                  value={productId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        productsQuery.isFetching
                          ? "Searching..."
                          : productChoices.length
                            ? "Choose product"
                            : "No assigned products found"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {productChoices.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            </div>
            {product && product.variants.length > 0 ? (
              <Label>
                Variant
                <Select
                  aria-label="Variant"
                  onValueChange={(next) => {
                    setVariantId(next === NO_VARIANT_VALUE ? "" : next);
                    setValues(createEmptyActionValues());
                  }}
                  value={variantId || NO_VARIANT_VALUE}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Base product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VARIANT_VALUE}>Base product</SelectItem>
                    {product.variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.name} ({variant.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            ) : null}
          </div>
          {productsQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(productsQuery.error) ?? "Unable to search products."}
            </p>
          ) : null}
          {product && warehouseId && !isProductInWarehouse ? (
            <p className="formError" role="alert">
              {product.name} is not assigned to {selectedWarehouse?.name ?? "this warehouse"}.
              {isSuperAdmin ? " Assign it from the product page first." : " Ask the super admin to assign it."}
            </p>
          ) : null}
          {ready ? (
            <StockSnapshot
              batches={allBatches}
              isLoading={stockLineQuery.isLoading || batchesQuery.isLoading}
              stockLine={stockLine}
            />
          ) : null}
        </fieldset>

        {ready ? (
          <fieldset className="inventoryActionStep">
            <legend>2. {STOCK_ACTIONS.find((option) => option.value === action)?.label}</legend>
            <div className="formGrid inventoryActionGrid">
              {action === "receive" ? (
                <>
                  <ActionField error={errors.batchNumber} hint={allBatches.length ? "Reuse a batch number to add to it." : undefined} label="Batch number">
                    <Input
                      aria-label="Batch number"
                      list="inventory-existing-batches"
                      maxLength={120}
                      onChange={(event) => updateValue("batchNumber", event.target.value)}
                      value={values.batchNumber}
                    />
                    <datalist id="inventory-existing-batches">
                      {allBatches.map((batch) => (
                        <option key={batch.id} value={batch.batchNumber} />
                      ))}
                    </datalist>
                  </ActionField>
                  <ActionField error={errors.expiryDate} label={product?.expirySensitive ? "Expiry date" : "Expiry date (optional)"}>
                    <Input aria-label="Expiry date" onChange={(event) => updateValue("expiryDate", event.target.value)} type="date" value={values.expiryDate} />
                  </ActionField>
                  <ActionField error={errors.quantity} label="Units received">
                    <Input aria-label="Units received" inputMode="numeric" onChange={(event) => updateValue("quantity", event.target.value)} value={values.quantity} />
                  </ActionField>
                  <ActionField error={errors.purchasePrice} label="Purchase price per unit">
                    <Input aria-label="Purchase price per unit" inputMode="decimal" onChange={(event) => updateValue("purchasePrice", event.target.value)} value={values.purchasePrice} />
                  </ActionField>
                  <ActionField error={errors.sellingPrice} label="Selling price">
                    <Input aria-label="Selling price" inputMode="decimal" onChange={(event) => updateValue("sellingPrice", event.target.value)} value={values.sellingPrice} />
                  </ActionField>
                  <ActionField error={errors.mrp} label="MRP">
                    <Input aria-label="MRP" inputMode="decimal" onChange={(event) => updateValue("mrp", event.target.value)} value={values.mrp} />
                  </ActionField>
                  <ActionField error={errors.lowStockThreshold} hint="Alert when available units fall to this number." label="Low-stock threshold">
                    <Input aria-label="Low-stock threshold" inputMode="numeric" onChange={(event) => updateValue("lowStockThreshold", event.target.value)} value={values.lowStockThreshold} />
                  </ActionField>
                </>
              ) : null}

              {action !== "receive" ? (
                <ActionField error={errors.batchNumber} label="Batch">
                  <BatchSelect
                    batches={action === "count" ? allBatches : batchesWithStock}
                    onChange={(batchNumber) => updateValue("batchNumber", batchNumber)}
                    value={values.batchNumber}
                  />
                </ActionField>
              ) : null}

              {action === "remove" || action === "transfer" ? (
                <ActionField
                  error={errors.quantity}
                  hint={selectedBatch ? `Up to ${selectedBatch.quantity} units in this batch.` : undefined}
                  label={action === "remove" ? "Units to remove" : "Units to move"}
                >
                  <Input
                    aria-label={action === "remove" ? "Units to remove" : "Units to move"}
                    inputMode="numeric"
                    onChange={(event) => updateValue("quantity", event.target.value)}
                    value={values.quantity}
                  />
                </ActionField>
              ) : null}

              {action === "remove" ? (
                <ActionField error={errors.stockOutReason} label="Reason">
                  <Select
                    aria-label="Reason"
                    onValueChange={(next) => updateValue("stockOutReason", next as StockOutReason)}
                    value={values.stockOutReason}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Why is it leaving?" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_OUT_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {STOCK_OUT_REASON_LABELS[reason]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ActionField>
              ) : null}

              {action === "count" ? (
                <>
                  <ActionField
                    error={errors.countedQuantity}
                    hint={
                      selectedBatch && /^\d+$/.test(values.countedQuantity)
                        ? `System shows ${selectedBatch.quantity}. Change: ${formatSignedQuantity(Number(values.countedQuantity) - selectedBatch.quantity)} units.`
                        : selectedBatch
                          ? `System shows ${selectedBatch.quantity} units.`
                          : undefined
                    }
                    label="Units counted"
                  >
                    <Input aria-label="Units counted" inputMode="numeric" onChange={(event) => updateValue("countedQuantity", event.target.value)} value={values.countedQuantity} />
                  </ActionField>
                  <ActionField error={errors.reason} label="Reason">
                    <Input aria-label="Reason" maxLength={1000} onChange={(event) => updateValue("reason", event.target.value)} value={values.reason} />
                  </ActionField>
                </>
              ) : null}

              {action === "transfer" ? (
                <ActionField
                  error={errors.toWarehouseId}
                  hint={transferDestinations.length === 0 ? "This product is not assigned to any other active warehouse you can reach." : undefined}
                  label="To warehouse"
                >
                  <Select
                    aria-label="To warehouse"
                    disabled={transferDestinations.length === 0}
                    onValueChange={(next) => updateValue("toWarehouseId", next)}
                    value={values.toWarehouseId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {transferDestinations.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ActionField>
              ) : null}
            </div>
            {action !== "count" ? (
              <ActionField error={errors.notes} label="Notes (optional)">
                <Textarea aria-label="Notes" maxLength={1000} onChange={(event) => updateValue("notes", event.target.value)} value={values.notes} />
              </ActionField>
            ) : null}
            {formError ? (
              <p className="formError" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="actionRow inventoryActionSubmit">
              <Button className="iconTextButton" disabled={mutation.isPending} type="submit">
                {ACTION_ICONS[action]}
                <span>{STOCK_ACTIONS.find((option) => option.value === action)?.label}</span>
              </Button>
            </div>
          </fieldset>
        ) : (
          <p className="inventoryActionPrompt">
            {warehouseId
              ? "Choose a product assigned to this warehouse to continue."
              : "Choose a warehouse to see the products assigned to it."}
          </p>
        )}
      </form>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={mutation.isPending}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </Card>
  );
}

const ACTION_ICONS: Record<StockAction, ReactNode> = {
  count: <ClipboardCheck aria-hidden size={18} />,
  receive: <PackagePlus aria-hidden size={18} />,
  remove: <PackageMinus aria-hidden size={18} />,
  transfer: <ArrowRightLeft aria-hidden size={18} />
};

function StockSnapshot({
  batches,
  isLoading,
  stockLine
}: {
  batches: StockBatch[];
  isLoading: boolean;
  stockLine: InventoryStock | null;
}) {
  if (isLoading) {
    return <LoadingState label="Loading current stock..." />;
  }

  const withStock = batches.filter((batch) => batch.quantity > 0);

  return (
    <div aria-label="Current stock" className="inventorySnapshot" role="group">
      <div>
        <span>On hand</span>
        <strong>{(stockLine?.availableQuantity ?? 0).toLocaleString("en-IN")}</strong>
      </div>
      <div>
        <span>Reserved</span>
        <strong>{(stockLine?.reservedQuantity ?? 0).toLocaleString("en-IN")}</strong>
      </div>
      <div>
        <span>Threshold</span>
        <strong>{(stockLine?.lowStockThreshold ?? 0).toLocaleString("en-IN")}</strong>
      </div>
      <div>
        <span>Batches with units</span>
        <strong>{withStock.length}</strong>
      </div>
      {stockLine ? <StatusBadge status={stockLine.stockStatus ?? getStockLevel(stockLine)} /> : <StatusBadge status="OUT_OF_STOCK" />}
    </div>
  );
}

function BatchSelect({
  batches,
  onChange,
  value
}: {
  batches: StockBatch[];
  onChange: (batchNumber: string) => void;
  value: string;
}) {
  return (
    <Select aria-label="Batch" disabled={batches.length === 0} onValueChange={onChange} value={value}>
      <SelectTrigger>
        <SelectValue placeholder={batches.length ? "Choose batch" : "No batches with units"} />
      </SelectTrigger>
      <SelectContent>
        {batches.map((batch) => (
          <SelectItem key={batch.id} value={batch.batchNumber}>
            {batch.batchNumber} · {batch.quantity} units
            {batch.expiryDate ? ` · expires ${formatDate(batch.expiryDate)}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActionField({
  children,
  error,
  hint,
  label
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  label: string;
}) {
  return (
    <div className="inventoryActionField">
      <span className="inventoryActionLabel">{label}</span>
      {children}
      {hint && !error ? <span className="helperText">{hint}</span> : null}
      {error ? <span className="fieldError">{error}</span> : null}
    </div>
  );
}

function MovementLogPanel({
  filters,
  onFiltersChange,
  showWarehouseColumn
}: {
  filters: InventoryFilters;
  onFiltersChange: (filters: InventoryFilters) => void;
  showWarehouseColumn: boolean;
}) {
  const { api } = useAdminSession();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const query = useMemo(
    () => buildStockMovementQuery(filters, page, INVENTORY_PAGE_SIZE),
    [filters, page]
  );
  const movementsQuery = useQuery<PaginatedResponse<StockMovement>>({
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) =>
      api.request<PaginatedResponse<StockMovement>>("/admin/inventory/movements", { query, signal }),
    queryKey: ["admin", "inventory", "movements", query]
  });
  const movements = movementsQuery.data?.items ?? [];
  const pagination = movementsQuery.data?.pagination;
  const filterScope = JSON.stringify({ ...filters, search: "" });

  useEffect(() => {
    setPage(1);
  }, [filterScope]);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  return (
    <Card className="panel mt-3 inventorySectionPanel inventoryTablePanel">
      <PageHeader
        className="inventorySectionHeader"
        eyebrow="Movement log"
        level={2}
        title="Every stock change, newest first"
      />
      <div className="inventoryToolbar">
        <div aria-label="Movement type" className="inventorySegmented" role="group">
          {MOVEMENT_FILTERS.map((option) => (
            <Button
              aria-pressed={filters.movementType === option.value}
              key={option.value || "all"}
              onClick={() => onFiltersChange({ ...filters, movementType: option.value })}
              size="sm"
              type="button"
              variant={filters.movementType === option.value ? "default" : "outline"}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <form
          className="inventorySearchForm"
          onSubmit={(event) => {
            event.preventDefault();
            onFiltersChange({ ...filters, search: searchDraft.trim().slice(0, 160) });
          }}
          role="search"
        >
          <span className="searchInput">
            <Search aria-hidden size={16} />
            <Input
              aria-label="Search movements by product name or SKU"
              maxLength={160}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Product name or SKU"
              value={searchDraft}
            />
          </span>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <ActiveInventoryFilters filters={filters} onChange={onFiltersChange} />
      </div>
      {movementsQuery.isLoading ? <LoadingState label="Loading movement log..." /> : null}
      {movementsQuery.isError ? (
        <p className="formError" role="alert">
          {getErrorMessage(movementsQuery.error) ?? "Unable to load stock movements."}
        </p>
      ) : null}
      {!movementsQuery.isLoading && !movementsQuery.isError ? (
        <MovementTable movements={movements} showWarehouseColumn={showWarehouseColumn} />
      ) : null}
      {pagination ? (
        <PaginationControls
          isPending={movementsQuery.isFetching && !movementsQuery.isLoading}
          onChange={setPage}
          page={pagination.page}
          pageSize={pagination.limit}
          totalItems={pagination.total}
          totalPages={pagination.totalPages}
        />
      ) : null}
    </Card>
  );
}

function MovementTable({
  movements,
  showWarehouseColumn
}: {
  movements: StockMovement[];
  showWarehouseColumn: boolean;
}) {
  if (movements.length === 0) {
    return (
      <EmptyState
        body="No stock movements match these filters."
        title="No movements found"
      />
    );
  }

  return (
    <div className="inventoryTableShell">
      <p className="inventoryTableHint">Swipe sideways to view every movement column.</p>
      <div className="brandTableScroll inventoryTableScroll">
        <Table aria-label="Stock movements" className="brandDataTable inventoryDataTable inventoryMovementDataTable">
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead>Product</TableHead>
              {showWarehouseColumn ? <TableHead>Warehouse</TableHead> : null}
              <TableHead>Batch</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => {
              const change = getMovementNetQuantity(movement);

              return (
                <TableRow key={movement.id}>
                  <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                  <TableCell>
                    <strong>{describeMovement(movement)}</strong>
                  </TableCell>
                  <TableCell>
                    {formatStockItemName(movement)}
                    {movement.product ? <span className="tableSubtext">{movement.product.sku}</span> : null}
                  </TableCell>
                  {showWarehouseColumn ? (
                    <TableCell>{movement.warehouse?.name ?? movement.warehouseId}</TableCell>
                  ) : null}
                  <TableCell>{movement.batchNumber ?? "-"}</TableCell>
                  <TableCell>
                    <span className="inventoryChange" data-direction={change > 0 ? "in" : change < 0 ? "out" : "none"}>
                      {formatSignedQuantity(change)}
                    </span>
                  </TableCell>
                  <TableCell>{movement.createdBy?.name ?? "System"}</TableCell>
                  <TableCell>{movement.notes || "-"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function warehouseName(warehouses: AdminWarehouse[], warehouseId: string) {
  return warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId;
}

function pick<T extends object, K extends keyof T>(value: T, keys: K[]) {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>;
}

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "-";
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

/** Maps zod issues to form fields, renaming schema keys where the form calls them something else. */
function getFieldErrors(error: z.ZodError, rename: Record<string, string> = {}) {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const errors: FieldErrors = {};

  for (const [field, messages] of Object.entries(flattened)) {
    if (messages?.[0]) {
      errors[rename[field] ?? field] = messages[0];
    }
  }

  return errors;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
