"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterDrawer } from "@/components/admin/filter-drawer";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  adjustStockFormSchema,
  buildAdjustStockPayload,
  buildInventoryRequest,
  buildStockMovementQuery,
  buildStockInPayload,
  buildTransferStockPayload,
  createEmptyAdjustStockFormValues,
  createEmptyInventoryFilters,
  createInventoryFiltersFromSearchParams,
  createEmptyStockInFormValues,
  createEmptyTransferStockFormValues,
  formatMovementType,
  INVENTORY_TABS,
  inventoryFiltersSchema,
  isLowStock,
  isNearExpiry,
  loadAllPaginatedItems,
  STOCK_MOVEMENT_TYPES,
  stockInFormSchema,
  transferStockFormSchema,
  type AdjustStockFormValues,
  type InventoryFilters,
  type InventoryStock,
  type InventoryView,
  type PaginatedResponse,
  type StockBatch,
  type StockInFormValues,
  type StockMovement,
  type TransferStockFormValues
} from "../../lib/inventory-management";
import type {
  AdminWarehouse,
  WarehouseListResponse
} from "../../lib/warehouse-management";

type StockInInputValues = ReturnType<typeof createEmptyStockInFormValues>;
type AdjustInputValues = ReturnType<typeof createEmptyAdjustStockFormValues>;
type TransferInputValues = ReturnType<typeof createEmptyTransferStockFormValues>;
type FieldErrors<TFields extends Record<string, unknown>> = Partial<
  Record<keyof TFields, string>
>;

const PRODUCT_SELECT_EMPTY_VALUE = "__product_select_empty__";
const VARIANT_SELECT_EMPTY_VALUE = "__variant_select_empty__";
const WAREHOUSE_SELECT_EMPTY_VALUE = "__warehouse_select_empty__";
const MOVEMENT_TYPE_SELECT_EMPTY_VALUE = "__movement_type_select_empty__";
const INVENTORY_PAGE_SIZE = 20;
const LOOKUP_PAGE_SIZE = 100;

const INVENTORY_VIEW_CONTENT: Record<
  InventoryView,
  {
    heading: string;
    summary: string;
  }
> = {
  actions: {
    heading: "Stock actions",
    summary: "Receive, adjust, and transfer stock from a focused action workspace."
  },
  movements: {
    heading: "Movement history",
    summary:
      "Review the inventory movement audit trail with warehouse and product filters."
  },
  overview: {
    heading: "Stock overview",
    summary: "Monitor assigned warehouse stock, low-stock warnings, and expiry risk."
  }
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
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const urlFilters = useMemo(
    () => createInventoryFiltersFromSearchParams(new URLSearchParams(searchKey)),
    [searchKey]
  );
  const [draftFilters, setDraftFilters] = useState<InventoryFilters>(urlFilters);
  const [appliedFilters, setAppliedFilters] = useState<InventoryFilters>(urlFilters);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [stockInValues, setStockInValues] = useState<StockInInputValues>(
    createEmptyStockInFormValues()
  );
  const [adjustValues, setAdjustValues] = useState<AdjustInputValues>(
    createEmptyAdjustStockFormValues()
  );
  const [transferValues, setTransferValues] = useState<TransferInputValues>(
    createEmptyTransferStockFormValues()
  );
  const [stockInErrors, setStockInErrors] = useState<FieldErrors<StockInInputValues>>(
    {}
  );
  const [adjustErrors, setAdjustErrors] = useState<FieldErrors<AdjustInputValues>>({});
  const [transferErrors, setTransferErrors] = useState<
    FieldErrors<TransferInputValues>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [nearExpiryPage, setNearExpiryPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
  const viewContent = INVENTORY_VIEW_CONTENT[view];
  const isOverviewView = view === "overview";
  const isActionsView = view === "actions";
  const isMovementsView = view === "movements";
  const hasFilters = isOverviewView || isMovementsView;

  useEffect(() => {
    setFilterError(null);
    setDraftFilters(urlFilters);
    setAppliedFilters(urlFilters);
  }, [urlFilters]);

  const inventoryRequest = useMemo(
    () =>
      buildInventoryRequest(appliedFilters, {
        limit: INVENTORY_PAGE_SIZE,
        page: inventoryPage
      }),
    [appliedFilters, inventoryPage]
  );
  const scopedQuery = useMemo(
    () =>
      buildInventoryRequest(
        {
          ...appliedFilters,
          lowStock: false,
          nearExpiry: false
        },
        { limit: LOOKUP_PAGE_SIZE, page: 1 }
      ).query,
    [appliedFilters]
  );
  const movementQuery = useMemo(
    () => buildStockMovementQuery(appliedFilters, movementsPage, INVENTORY_PAGE_SIZE),
    [appliedFilters, movementsPage]
  );

  const warehousesQuery = useQuery({
    enabled: hasPermission(ADMIN_PERMISSION.WarehouseRead),
    queryFn: () =>
      loadAllPaginatedItems<AdminWarehouse>((page) =>
        api.request<WarehouseListResponse>("/admin/warehouses", {
          query: { limit: LOOKUP_PAGE_SIZE, page }
        })
      ),
    queryKey: ["admin", "inventory", "warehouses"]
  });
  const productsQuery = useQuery({
    enabled: hasPermission(ADMIN_PERMISSION.ProductsRead),
    queryFn: () =>
      loadAllPaginatedItems<AdminProduct>((page) =>
        api.request<ProductListResponse>("/admin/products", {
          query: { limit: LOOKUP_PAGE_SIZE, page }
        })
      ),
    queryKey: ["admin", "inventory", "products"]
  });
  const inventoryQuery = useQuery({
    enabled: isOverviewView,
    queryFn: () =>
      api.request<PaginatedResponse<InventoryStock> | PaginatedResponse<StockBatch>>(
        inventoryRequest.endpoint,
        {
          query: inventoryRequest.query
        }
      ),
    queryKey: ["admin", "inventory", "list", inventoryRequest]
  });
  const lowStockQuery = useQuery({
    enabled: isOverviewView,
    queryFn: () =>
      api.request<PaginatedResponse<InventoryStock>>("/admin/inventory/low-stock", {
        query: scopedQuery
      }),
    queryKey: ["admin", "inventory", "low-stock", scopedQuery]
  });
  const nearExpiryQuery = useQuery({
    enabled: isOverviewView,
    queryFn: () =>
      loadAllPaginatedItems<StockBatch>((page) =>
        api.request<PaginatedResponse<StockBatch>>("/admin/inventory/near-expiry", {
          query: {
            ...scopedQuery,
            days: Number(appliedFilters.nearExpiryDays),
            page
          }
        })
      ),
    queryKey: [
      "admin",
      "inventory",
      "near-expiry",
      scopedQuery,
      appliedFilters.nearExpiryDays
    ]
  });
  const movementsQuery = useQuery({
    enabled: isMovementsView,
    queryFn: () =>
      api.request<PaginatedResponse<StockMovement>>("/admin/inventory/movements", {
        query: movementQuery
      }),
    queryKey: ["admin", "inventory", "movements", movementQuery]
  });

  const stockInMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildStockInPayload>) =>
      api.request<InventoryStock>("/admin/inventory/stock-in", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const adjustMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildAdjustStockPayload>) =>
      api.request<InventoryStock>("/admin/inventory/adjust", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const transferMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildTransferStockPayload>) =>
      api.request("/admin/inventory/transfer", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });

  const products = productsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const stockInVariants = getProductVariants(products, stockInValues.productId);
  const adjustVariants = getProductVariants(products, adjustValues.productId);
  const transferVariants = getProductVariants(products, transferValues.productId);
  const lowStockItems = lowStockQuery.data?.items ?? [];
  const nearExpiryItems = nearExpiryQuery.data ?? [];
  const movements = movementsQuery.data?.items ?? [];
  const lowStockKeys = new Set(lowStockItems.map(stockKey));
  const nearExpiryKeys = new Set(nearExpiryItems.map(batchKey));
  const mutationError =
    getErrorMessage(stockInMutation.error) ??
    getErrorMessage(adjustMutation.error) ??
    getErrorMessage(transferMutation.error);
  const isMutating =
    stockInMutation.isPending || adjustMutation.isPending || transferMutation.isPending;
  const isLookupLoading = productsQuery.isLoading || warehousesQuery.isLoading;
  const inventoryPagination = inventoryQuery.data?.pagination;
  const movementPagination = movementsQuery.data?.pagination;
  const nearExpiryTotalPages = Math.max(
    Math.ceil(nearExpiryItems.length / INVENTORY_PAGE_SIZE),
    1
  );
  const visibleNearExpiryItems = nearExpiryItems.slice(
    (nearExpiryPage - 1) * INVENTORY_PAGE_SIZE,
    nearExpiryPage * INVENTORY_PAGE_SIZE
  );

  useEffect(() => {
    if (
      inventoryPagination &&
      inventoryPage > Math.max(inventoryPagination.totalPages, 1)
    ) {
      setInventoryPage(Math.max(inventoryPagination.totalPages, 1));
    }
  }, [inventoryPage, inventoryPagination]);

  useEffect(() => {
    if (
      movementPagination &&
      movementsPage > Math.max(movementPagination.totalPages, 1)
    ) {
      setMovementsPage(Math.max(movementPagination.totalPages, 1));
    }
  }, [movementPagination, movementsPage]);

  useEffect(() => {
    if (nearExpiryPage > nearExpiryTotalPages) {
      setNearExpiryPage(nearExpiryTotalPages);
    }
  }, [nearExpiryPage, nearExpiryTotalPages]);

  async function refreshInventory() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = inventoryFiltersSchema.safeParse(draftFilters);

    if (!parsed.success) {
      setFilterError(parsed.error.issues[0]?.message ?? "Check the inventory filters.");
      return;
    }

    setFilterError(null);
    setAppliedFilters(parsed.data);
    setInventoryPage(1);
    setMovementsPage(1);
    setNearExpiryPage(1);
    setIsFilterDrawerOpen(false);
  }

  function resetFilters() {
    const emptyFilters = createEmptyInventoryFilters();
    setFilterError(null);
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setInventoryPage(1);
    setMovementsPage(1);
    setNearExpiryPage(1);
  }

  function handleStockInSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = stockInFormSchema.safeParse(stockInValues);

    if (!parsed.success) {
      setStockInErrors(getFieldErrors<StockInInputValues>(parsed.error));
      return;
    }

    setStockInErrors({});
    setConfirmation({
      body: `Receive ${parsed.data.quantity} units for ${productLabel(products, parsed.data.productId, parsed.data.variantId || null)} into ${warehouseLabel(warehouses, parsed.data.warehouseId)} under batch ${parsed.data.batchNumber}?`,
      confirmLabel: "Receive stock",
      onConfirm: () => submitStockIn(parsed.data),
      title: "Confirm stock in"
    });
  }

  function handleAdjustSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = adjustStockFormSchema.safeParse(adjustValues);

    if (!parsed.success) {
      setAdjustErrors(getFieldErrors<AdjustInputValues>(parsed.error));
      return;
    }

    setAdjustErrors({});
    setConfirmation({
      body: `Apply a ${parsed.data.quantityDelta} unit adjustment for ${productLabel(products, parsed.data.productId, parsed.data.variantId || null)} in ${warehouseLabel(warehouses, parsed.data.warehouseId)}?`,
      confirmLabel: "Adjust stock",
      onConfirm: () => submitAdjustment(parsed.data),
      title: "Confirm stock adjustment"
    });
  }

  function handleTransferSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = transferStockFormSchema.safeParse(transferValues);

    if (!parsed.success) {
      setTransferErrors(getFieldErrors<TransferInputValues>(parsed.error));
      return;
    }

    setTransferErrors({});
    setConfirmation({
      body: `Transfer ${parsed.data.quantity} units of ${productLabel(products, parsed.data.productId, parsed.data.variantId || null)} from ${warehouseLabel(warehouses, parsed.data.fromWarehouseId)} to ${warehouseLabel(warehouses, parsed.data.toWarehouseId)}?`,
      confirmLabel: "Transfer stock",
      onConfirm: () => submitTransfer(parsed.data),
      title: "Confirm stock transfer"
    });
  }

  async function submitStockIn(values: StockInFormValues) {
    setMessage(null);
    await stockInMutation.mutateAsync(buildStockInPayload(values));
    setStockInValues(createEmptyStockInFormValues());
    setMessage("Stock received.");
    await refreshInventory();
  }

  async function submitAdjustment(values: AdjustStockFormValues) {
    setMessage(null);
    await adjustMutation.mutateAsync(buildAdjustStockPayload(values));
    setAdjustValues(createEmptyAdjustStockFormValues());
    setMessage("Stock adjusted.");
    await refreshInventory();
  }

  async function submitTransfer(values: TransferStockFormValues) {
    setMessage(null);
    await transferMutation.mutateAsync(buildTransferStockPayload(values));
    setTransferValues(createEmptyTransferStockFormValues());
    setMessage("Stock transferred.");
    await refreshInventory();
  }

  return (
    <>
      <Card className="panel">
        <PageHeader
          level={2}
          actions={
            <>
              {hasFilters ? (
                <Button
                  className="iconTextButton"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  type="button"
                >
                  <SlidersHorizontal aria-hidden size={16} />
                  <span>Add filter</span>
                </Button>
              ) : null}
              <Button
                className="iconTextButton"
                onClick={() => void refreshInventory()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </>
          }
          eyebrow="Inventory control"
          summary={viewContent.summary}
          title={viewContent.heading}
        />
        <InventorySubTabs activeView={view} />

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        {isOverviewView ? (
          <div className="metricGrid resourceMetrics">
            <MetricCard
              label={
                inventoryRequest.type === "batch" ? "Matching batches" : "Stock rows"
              }
              tone="primary"
              value={inventoryQuery.data?.pagination.total ?? 0}
            />
            <MetricCard
              label="Low stock"
              tone="warning"
              value={lowStockQuery.data?.pagination.total ?? lowStockItems.length}
            />
            <MetricCard
              label="Near expiry"
              tone="warning"
              value={nearExpiryItems.length}
            />
            <MetricCard label="Warehouses" value={warehouses.length} />
          </div>
        ) : null}
      </Card>

      {hasFilters ? (
        <>
          <FilterDrawer
            error={filterError}
            isOpen={isFilterDrawerOpen}
            isSubmitting={
              inventoryQuery.isFetching ||
              lowStockQuery.isFetching ||
              nearExpiryQuery.isFetching ||
              movementsQuery.isFetching
            }
            onApply={handleFilterSubmit}
            onOpenChange={setIsFilterDrawerOpen}
            onReset={resetFilters}
            summary="Search and refine inventory stock, warning, and movement records."
            title={isMovementsView ? "Movement filters" : "Inventory filters"}
          >
            <InventoryFilterFields
              filters={draftFilters}
              isLoading={productsQuery.isLoading || warehousesQuery.isLoading}
              onChange={setDraftFilters}
              products={products}
              showWarningFilters={isOverviewView}
              showMovementType={isMovementsView}
              warehouses={warehouses}
            />
          </FilterDrawer>
          {productsQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(productsQuery.error) ?? "Unable to load products."}
            </p>
          ) : null}
          {warehousesQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
            </p>
          ) : null}
        </>
      ) : null}

      {isActionsView ? (
        <PermissionGate
          fallback={
            <EmptyState
              body="Your admin role cannot perform inventory stock actions."
              title="Stock actions unavailable"
            />
          }
          permission={ADMIN_PERMISSION.InventoryUpdate}
        >
          <Card className="panel mt-3">
            <PageHeader
              level={2}
              eyebrow="Stock actions"
              title="Receive, adjust, and transfer stock"
            />
            {productsQuery.isError ? (
              <p className="formError" role="alert">
                {getErrorMessage(productsQuery.error) ?? "Unable to load products."}
              </p>
            ) : null}
            {warehousesQuery.isError ? (
              <p className="formError" role="alert">
                {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
              </p>
            ) : null}
            <div className="threeColumnGrid">
              <StockInForm
                errors={stockInErrors}
                isSaving={stockInMutation.isPending}
                onChange={setStockInValues}
                onSubmit={handleStockInSubmit}
                products={products}
                values={stockInValues}
                variants={stockInVariants}
                warehouses={warehouses}
              />
              <AdjustStockForm
                errors={adjustErrors}
                isSaving={adjustMutation.isPending}
                onChange={setAdjustValues}
                onSubmit={handleAdjustSubmit}
                products={products}
                values={adjustValues}
                variants={adjustVariants}
                warehouses={warehouses}
              />
              <TransferStockForm
                errors={transferErrors}
                isSaving={transferMutation.isPending}
                onChange={setTransferValues}
                onSubmit={handleTransferSubmit}
                products={products}
                values={transferValues}
                variants={transferVariants}
                warehouses={warehouses}
              />
            </div>
          </Card>
        </PermissionGate>
      ) : null}

      {view === "overview" ? (
        <>
          <Card className="panel my-3">
            <PageHeader
              level={2}
              eyebrow="Stock table"
              title={
                inventoryRequest.type === "batch"
                  ? "Near-expiry batches"
                  : "Current aggregate stock"
              }
            />
            {inventoryQuery.isLoading || isLookupLoading ? (
              <LoadingState label="Loading inventory..." />
            ) : null}
            {inventoryQuery.isError ? (
              <p className="formError" role="alert">
                {getErrorMessage(inventoryQuery.error) ?? "Unable to load inventory."}
              </p>
            ) : null}
            {!inventoryQuery.isLoading &&
            !isLookupLoading &&
            !inventoryQuery.isError ? (
              inventoryRequest.type === "batch" ? (
                <BatchTable
                  batches={(inventoryQuery.data?.items ?? []) as StockBatch[]}
                  nearExpiryDays={Number(appliedFilters.nearExpiryDays)}
                  products={products}
                  warehouses={warehouses}
                />
              ) : (
                <StockTable
                  lowStockKeys={lowStockKeys}
                  nearExpiryKeys={nearExpiryKeys}
                  products={products}
                  stocks={(inventoryQuery.data?.items ?? []) as InventoryStock[]}
                  warehouses={warehouses}
                />
              )
            ) : null}
            {inventoryPagination && inventoryPagination.totalPages > 1 ? (
              <PaginationControls
                onChange={setInventoryPage}
                page={inventoryPagination.page}
                totalPages={inventoryPagination.totalPages}
              />
            ) : null}
          </Card>

          {!appliedFilters.nearExpiry ? (
            <Card className="panel">
              <PageHeader
                level={2}
                eyebrow="Near expiry"
                summary={`Expiry window: ${appliedFilters.nearExpiryDays} days.`}
                title="Positive batches expiring soon"
              />
              {nearExpiryQuery.isLoading || isLookupLoading ? (
                <LoadingState label="Loading near-expiry batches..." />
              ) : null}
              {nearExpiryQuery.isError ? (
                <p className="formError" role="alert">
                  {getErrorMessage(nearExpiryQuery.error) ??
                    "Unable to load near-expiry batches."}
                </p>
              ) : null}
              {!nearExpiryQuery.isLoading &&
              !isLookupLoading &&
              !nearExpiryQuery.isError ? (
                <BatchTable
                  batches={visibleNearExpiryItems}
                  nearExpiryDays={Number(appliedFilters.nearExpiryDays)}
                  products={products}
                  warehouses={warehouses}
                />
              ) : null}
              {nearExpiryTotalPages > 1 ? (
                <PaginationControls
                  onChange={setNearExpiryPage}
                  page={nearExpiryPage}
                  totalPages={nearExpiryTotalPages}
                />
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}

      {view === "movements" ? (
        <Card className="panel mt-3">
          <PageHeader
            level={2}
            eyebrow="Movement history"
            title="Stock movement audit trail"
          />
          {movementsQuery.isLoading || isLookupLoading ? (
            <LoadingState label="Loading movement history..." />
          ) : null}
          {movementsQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(movementsQuery.error) ??
                "Unable to load stock movements."}
            </p>
          ) : null}
          {!movementsQuery.isLoading && !isLookupLoading && !movementsQuery.isError ? (
            <MovementTable
              movements={movements}
              products={products}
              warehouses={warehouses}
            />
          ) : null}
          {movementPagination && movementPagination.totalPages > 1 ? (
            <PaginationControls
              onChange={setMovementsPage}
              page={movementPagination.page}
              totalPages={movementPagination.totalPages}
            />
          ) : null}
        </Card>
      ) : null}

      {isActionsView ? (
        <ConfirmationDialog
          confirmation={confirmation}
          isPending={isMutating}
          onCancel={() => setConfirmation(null)}
          onConfirmComplete={() => setConfirmation(null)}
        />
      ) : null}
    </>
  );
}

function InventorySubTabs({ activeView }: { activeView: InventoryView }) {
  return (
    <nav aria-label="Inventory sections" className="inventorySubTabs">
      {INVENTORY_TABS.map((tab) => (
        <Link
          aria-current={activeView === tab.value ? "page" : undefined}
          className="inventorySubTab"
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function InventoryFilterFields({
  filters,
  isLoading,
  onChange,
  products,
  showWarningFilters = true,
  showMovementType = false,
  warehouses
}: {
  filters: InventoryFilters;
  isLoading: boolean;
  onChange: (filters: InventoryFilters) => void;
  products: AdminProduct[];
  showWarningFilters?: boolean;
  showMovementType?: boolean;
  warehouses: AdminWarehouse[];
}) {
  return (
    <div className="filterDrawerFields">
      <Label>
        Search
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <Input
            className="filterDrawerControl"
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Product or SKU"
            value={filters.search}
          />
        </span>
      </Label>
      <ProductSelect
        disabled={isLoading}
        onChange={(productId) => onChange({ ...filters, productId })}
        products={products}
        required={false}
        value={filters.productId}
      />
      <WarehouseSelect
        disabled={isLoading}
        onChange={(warehouseId) => onChange({ ...filters, warehouseId })}
        required={false}
        value={filters.warehouseId}
        warehouses={warehouses}
      />
      {showMovementType ? (
        <Label>
          Movement type
          <Select
            onValueChange={(nextValue) =>
              onChange({
                ...filters,
                movementType:
                  nextValue === MOVEMENT_TYPE_SELECT_EMPTY_VALUE
                    ? ""
                    : (nextValue as (typeof STOCK_MOVEMENT_TYPES)[number])
              })
            }
            value={filters.movementType || MOVEMENT_TYPE_SELECT_EMPTY_VALUE}
          >
            <SelectTrigger>
              <SelectValue placeholder="All movement types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MOVEMENT_TYPE_SELECT_EMPTY_VALUE}>
                All movement types
              </SelectItem>
              {STOCK_MOVEMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatMovementType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
      ) : null}
      {showWarningFilters ? (
        <>
          <Label className="checkField rowCheck">
            <Checkbox
              checked={filters.lowStock}
              onCheckedChange={(checked) =>
                onChange({
                  ...filters,
                  lowStock: checked === true,
                  nearExpiry: checked === true ? false : filters.nearExpiry
                })
              }
            />
            <span>Low stock</span>
          </Label>
          <Label className="checkField rowCheck">
            <Checkbox
              checked={filters.nearExpiry}
              onCheckedChange={(checked) =>
                onChange({
                  ...filters,
                  lowStock: checked === true ? false : filters.lowStock,
                  nearExpiry: checked === true
                })
              }
            />
            <span>Near expiry</span>
          </Label>
          <Label>
            Expiry window (days)
            <Input
              className="filterDrawerControl"
              max={365}
              min={1}
              onChange={(event) =>
                onChange({ ...filters, nearExpiryDays: event.target.value })
              }
              step={1}
              type="number"
              value={filters.nearExpiryDays}
            />
          </Label>
        </>
      ) : null}
    </div>
  );
}

function StockInForm({
  errors,
  isSaving,
  onChange,
  onSubmit,
  products,
  values,
  variants,
  warehouses
}: {
  errors: FieldErrors<StockInInputValues>;
  isSaving: boolean;
  onChange: (values: StockInInputValues) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  products: AdminProduct[];
  values: StockInInputValues;
  variants: AdminProduct["variants"];
  warehouses: AdminWarehouse[];
}) {
  function updateValue<Key extends keyof StockInInputValues>(
    key: Key,
    value: StockInInputValues[Key]
  ) {
    onChange({
      ...values,
      [key]: value
    });
  }

  return (
    <InventoryActionForm
      icon={<TrendingUp aria-hidden size={18} />}
      isSaving={isSaving}
      onSubmit={onSubmit}
      submitLabel="Stock in"
      title="Stock in"
    >
      <WarehouseSelect
        error={errors.warehouseId}
        onChange={(warehouseId) => updateValue("warehouseId", warehouseId)}
        value={values.warehouseId}
        warehouses={warehouses}
      />
      <ProductSelect
        error={errors.productId}
        onChange={(productId) => updateValue("productId", productId)}
        products={products}
        value={values.productId}
      />
      <VariantSelect
        error={errors.variantId}
        onChange={(variantId) => updateValue("variantId", variantId)}
        value={values.variantId}
        variants={variants}
      />
      <TextField
        error={errors.batchNumber}
        label="Batch number"
        onChange={(value) => updateValue("batchNumber", value)}
        value={values.batchNumber}
      />
      <TextField
        error={errors.expiryDate}
        label="Expiry date"
        onChange={(value) => updateValue("expiryDate", value)}
        required={false}
        type="date"
        value={values.expiryDate}
      />
      <TextField
        error={errors.quantity}
        inputMode="numeric"
        label="Quantity"
        onChange={(value) => updateValue("quantity", value)}
        value={values.quantity}
      />
      <TextField
        error={errors.purchasePrice}
        inputMode="decimal"
        label="Purchase price"
        onChange={(value) => updateValue("purchasePrice", value)}
        value={values.purchasePrice}
      />
      <TextField
        error={errors.sellingPrice}
        inputMode="decimal"
        label="Selling price"
        onChange={(value) => updateValue("sellingPrice", value)}
        value={values.sellingPrice}
      />
      <TextField
        error={errors.mrp}
        inputMode="decimal"
        label="MRP"
        onChange={(value) => updateValue("mrp", value)}
        value={values.mrp}
      />
      <TextField
        error={errors.lowStockThreshold}
        inputMode="numeric"
        label="Low-stock threshold"
        onChange={(value) => updateValue("lowStockThreshold", value)}
        required={false}
        value={values.lowStockThreshold}
      />
      <TextAreaField
        error={errors.notes}
        label="Notes"
        onChange={(value) => updateValue("notes", value)}
        value={values.notes}
      />
    </InventoryActionForm>
  );
}

function AdjustStockForm({
  errors,
  isSaving,
  onChange,
  onSubmit,
  products,
  values,
  variants,
  warehouses
}: {
  errors: FieldErrors<AdjustInputValues>;
  isSaving: boolean;
  onChange: (values: AdjustInputValues) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  products: AdminProduct[];
  values: AdjustInputValues;
  variants: AdminProduct["variants"];
  warehouses: AdminWarehouse[];
}) {
  function updateValue<Key extends keyof AdjustInputValues>(
    key: Key,
    value: AdjustInputValues[Key]
  ) {
    onChange({
      ...values,
      [key]: value
    });
  }

  return (
    <InventoryActionForm
      icon={<SlidersHorizontal aria-hidden size={18} />}
      isSaving={isSaving}
      onSubmit={onSubmit}
      submitLabel="Adjust"
      title="Adjust"
    >
      <WarehouseSelect
        error={errors.warehouseId}
        onChange={(warehouseId) => updateValue("warehouseId", warehouseId)}
        value={values.warehouseId}
        warehouses={warehouses}
      />
      <ProductSelect
        error={errors.productId}
        onChange={(productId) => updateValue("productId", productId)}
        products={products}
        value={values.productId}
      />
      <VariantSelect
        error={errors.variantId}
        onChange={(variantId) => updateValue("variantId", variantId)}
        value={values.variantId}
        variants={variants}
      />
      <TextField
        error={errors.batchNumber}
        label="Batch number"
        onChange={(value) => updateValue("batchNumber", value)}
        value={values.batchNumber}
      />
      <TextField
        error={errors.quantityDelta}
        inputMode="numeric"
        label="Quantity delta"
        onChange={(value) => updateValue("quantityDelta", value)}
        value={values.quantityDelta}
      />
      <TextField
        error={errors.lowStockThreshold}
        inputMode="numeric"
        label="Low-stock threshold"
        onChange={(value) => updateValue("lowStockThreshold", value)}
        required={false}
        value={values.lowStockThreshold}
      />
      <TextAreaField
        error={errors.reason}
        label="Reason"
        onChange={(value) => updateValue("reason", value)}
        required
        value={values.reason}
      />
    </InventoryActionForm>
  );
}

function TransferStockForm({
  errors,
  isSaving,
  onChange,
  onSubmit,
  products,
  values,
  variants,
  warehouses
}: {
  errors: FieldErrors<TransferInputValues>;
  isSaving: boolean;
  onChange: (values: TransferInputValues) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  products: AdminProduct[];
  values: TransferInputValues;
  variants: AdminProduct["variants"];
  warehouses: AdminWarehouse[];
}) {
  function updateValue<Key extends keyof TransferInputValues>(
    key: Key,
    value: TransferInputValues[Key]
  ) {
    onChange({
      ...values,
      [key]: value
    });
  }

  return (
    <InventoryActionForm
      icon={<ArrowRightLeft aria-hidden size={18} />}
      isSaving={isSaving}
      onSubmit={onSubmit}
      submitLabel="Transfer"
      title="Transfer"
    >
      <WarehouseSelect
        error={errors.fromWarehouseId}
        label="Source warehouse"
        onChange={(fromWarehouseId) => updateValue("fromWarehouseId", fromWarehouseId)}
        value={values.fromWarehouseId}
        warehouses={warehouses}
      />
      <WarehouseSelect
        error={errors.toWarehouseId}
        label="Destination warehouse"
        onChange={(toWarehouseId) => updateValue("toWarehouseId", toWarehouseId)}
        value={values.toWarehouseId}
        warehouses={warehouses}
      />
      <ProductSelect
        error={errors.productId}
        onChange={(productId) => updateValue("productId", productId)}
        products={products}
        value={values.productId}
      />
      <VariantSelect
        error={errors.variantId}
        onChange={(variantId) => updateValue("variantId", variantId)}
        value={values.variantId}
        variants={variants}
      />
      <TextField
        error={errors.batchNumber}
        label="Batch number"
        onChange={(value) => updateValue("batchNumber", value)}
        value={values.batchNumber}
      />
      <TextField
        error={errors.quantity}
        inputMode="numeric"
        label="Quantity"
        onChange={(value) => updateValue("quantity", value)}
        value={values.quantity}
      />
      <TextAreaField
        error={errors.notes}
        label="Notes"
        onChange={(value) => updateValue("notes", value)}
        value={values.notes}
      />
    </InventoryActionForm>
  );
}

function InventoryActionForm({
  children,
  icon,
  isSaving,
  onSubmit,
  submitLabel,
  title
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  title: string;
}) {
  return (
    <Card className="inventoryActionFormCard">
      <form className="formStack compactForm inventoryActionForm" onSubmit={onSubmit}>
        <h3>
          {icon}
          <span>{title}</span>
        </h3>
        {children}
        <Button className="iconTextButton" disabled={isSaving} type="submit">
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Working..." : submitLabel}</span>
        </Button>
      </form>
    </Card>
  );
}

function ProductSelect({
  disabled,
  error,
  onChange,
  products,
  required = true,
  value
}: {
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
  products: AdminProduct[];
  required?: boolean;
  value: string;
}) {
  const emptyLabel = required ? "Select product" : "All products";

  return (
    <Label>
      Product
      <Select
        disabled={disabled}
        onValueChange={(nextValue) =>
          onChange(nextValue === PRODUCT_SELECT_EMPTY_VALUE ? "" : nextValue)
        }
        value={value || PRODUCT_SELECT_EMPTY_VALUE}
      >
        <SelectTrigger>
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PRODUCT_SELECT_EMPTY_VALUE}>{emptyLabel}</SelectItem>
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
  );
}

function VariantSelect({
  error,
  onChange,
  value,
  variants
}: {
  error?: string;
  onChange: (value: string) => void;
  value: string;
  variants: AdminProduct["variants"];
}) {
  return (
    <Label>
      Variant
      <Select
        onValueChange={(nextValue) =>
          onChange(nextValue === VARIANT_SELECT_EMPTY_VALUE ? "" : nextValue)
        }
        value={value || VARIANT_SELECT_EMPTY_VALUE}
      >
        <SelectTrigger>
          <SelectValue placeholder="No variant" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={VARIANT_SELECT_EMPTY_VALUE}>No variant</SelectItem>
          {variants.map((variant) => (
            <SelectItem key={variant.id} value={variant.id}>
              {variant.name} ({variant.sku})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
  );
}

function WarehouseSelect({
  disabled,
  error,
  label = "Warehouse",
  onChange,
  required = true,
  value,
  warehouses
}: {
  disabled?: boolean;
  error?: string;
  label?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
  warehouses: AdminWarehouse[];
}) {
  const emptyLabel = required ? "Select warehouse" : "All warehouses";

  return (
    <Label>
      {label}
      <Select
        disabled={disabled}
        onValueChange={(nextValue) =>
          onChange(nextValue === WAREHOUSE_SELECT_EMPTY_VALUE ? "" : nextValue)
        }
        value={value || WAREHOUSE_SELECT_EMPTY_VALUE}
      >
        <SelectTrigger>
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WAREHOUSE_SELECT_EMPTY_VALUE}>{emptyLabel}</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
  );
}

function TextField({
  error,
  inputMode,
  label,
  onChange,
  required = true,
  type = "text",
  value
}: {
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <Label>
      {label}
      <Input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
  );
}

function TextAreaField({
  error,
  label,
  onChange,
  required = false,
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <Label>
      {label}
      <Textarea
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
  );
}

function StockTable({
  lowStockKeys,
  nearExpiryKeys,
  products,
  stocks,
  warehouses
}: {
  lowStockKeys: Set<string>;
  nearExpiryKeys: Set<string>;
  products: AdminProduct[];
  stocks: InventoryStock[];
  warehouses: AdminWarehouse[];
}) {
  if (stocks.length === 0) {
    return (
      <EmptyState
        body="No stock rows match the selected filters."
        title="No stock rows found"
      />
    );
  }

  return (
    <div className="brandTableScroll inventoryTableScroll">
      <Table className="brandDataTable inventoryDataTable">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Reserved</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Warnings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => {
            const key = stockKey(stock);
            const low = lowStockKeys.has(key) || isLowStock(stock);
            const nearExpiry = nearExpiryKeys.has(key);

            return (
              <TableRow key={stock.id}>
                <TableCell>
                  <strong>
                    {productLabel(products, stock.productId, stock.variantId)}
                  </strong>
                </TableCell>
                <TableCell>{warehouseLabel(warehouses, stock.warehouseId)}</TableCell>
                <TableCell>{stock.availableQuantity}</TableCell>
                <TableCell>{stock.reservedQuantity}</TableCell>
                <TableCell>{stock.lowStockThreshold}</TableCell>
                <TableCell className="flagList">
                  {low ? <b>Low stock</b> : null}
                  {nearExpiry ? <b>Near expiry</b> : null}
                  {!low && !nearExpiry ? <span>-</span> : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function BatchTable({
  batches,
  nearExpiryDays,
  products,
  warehouses
}: {
  batches: StockBatch[];
  nearExpiryDays: number;
  products: AdminProduct[];
  warehouses: AdminWarehouse[];
}) {
  if (batches.length === 0) {
    return (
      <EmptyState
        body="No batches match the selected filters."
        title="No batches found"
      />
    );
  }

  return (
    <div className="brandTableScroll inventoryTableScroll">
      <Table className="brandDataTable inventoryDataTable">
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead>Prices</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>
                <strong>{batch.batchNumber}</strong>
              </TableCell>
              <TableCell>
                {productLabel(products, batch.productId, batch.variantId)}
              </TableCell>
              <TableCell>{warehouseLabel(warehouses, batch.warehouseId)}</TableCell>
              <TableCell>{batch.quantity}</TableCell>
              <TableCell className="flagList">
                <span>{formatDate(batch.expiryDate)}</span>
                {isNearExpiry(batch.expiryDate, new Date(), nearExpiryDays) ? (
                  <b>Near expiry</b>
                ) : null}
              </TableCell>
              <TableCell>
                {formatCurrency(batch.sellingPrice)} / {formatCurrency(batch.mrp)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MovementTable({
  movements,
  products,
  warehouses
}: {
  movements: StockMovement[];
  products: AdminProduct[];
  warehouses: AdminWarehouse[];
}) {
  if (movements.length === 0) {
    return (
      <EmptyState
        body="No stock movements match the selected filters."
        title="No movements found"
      />
    );
  }

  return (
    <div className="brandTableScroll inventoryTableScroll">
      <Table className="brandDataTable inventoryDataTable">
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Reason / reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
              <TableCell>{formatMovementType(movement.type)}</TableCell>
              <TableCell>
                {productLabel(products, movement.productId, movement.variantId)}
              </TableCell>
              <TableCell>{warehouseLabel(warehouses, movement.warehouseId)}</TableCell>
              <TableCell>{movement.quantity}</TableCell>
              <TableCell>
                {movement.notes || formatMovementReference(movement) || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function productLabel(
  products: AdminProduct[],
  productId: string,
  variantId: string | null
) {
  const product = products.find((item) => item.id === productId);
  const variant = product?.variants.find((item) => item.id === variantId);

  if (!product) {
    return productId;
  }

  return variant ? `${product.name} - ${variant.name}` : product.name;
}

function warehouseLabel(warehouses: AdminWarehouse[], warehouseId: string) {
  return (
    warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId
  );
}

function getProductVariants(products: AdminProduct[], productId: string) {
  return products.find((product) => product.id === productId)?.variants ?? [];
}

function stockKey(
  stock: Pick<InventoryStock, "productId" | "variantId" | "warehouseId">
) {
  return `${stock.productId}:${stock.variantId ?? ""}:${stock.warehouseId}`;
}

function batchKey(batch: Pick<StockBatch, "productId" | "variantId" | "warehouseId">) {
  return `${batch.productId}:${batch.variantId ?? ""}:${batch.warehouseId}`;
}

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
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

function formatMovementReference(
  movement: Pick<StockMovement, "referenceId" | "referenceType">
) {
  if (!movement.referenceType) {
    return movement.referenceId;
  }

  const referenceType = movement.referenceType.toLowerCase().replaceAll("_", " ");
  return movement.referenceId
    ? `${referenceType} ${movement.referenceId}`
    : referenceType;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getFieldErrors<TFields extends Record<string, unknown>>(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const errors: Partial<Record<keyof TFields, string>> = {};

  for (const [field, messages] of Object.entries(flattened)) {
    if (messages?.[0]) {
      errors[field as keyof TFields] = messages[0];
    }
  }

  return errors;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
