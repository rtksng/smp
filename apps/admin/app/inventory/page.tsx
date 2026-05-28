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
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminShell } from "../admin-shell";
import { ConfirmationDialog, type ConfirmationState } from "../_components/confirmation-dialog";
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
  buildStockInPayload,
  buildTransferStockPayload,
  createEmptyAdjustStockFormValues,
  createEmptyInventoryFilters,
  createEmptyStockInFormValues,
  createEmptyTransferStockFormValues,
  formatMovementType,
  inventoryFiltersSchema,
  isLowStock,
  isNearExpiry,
  stockInFormSchema,
  transferStockFormSchema,
  type AdjustStockFormValues,
  type InventoryFilters,
  type InventoryStock,
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

export default function InventoryPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.InventoryRead}>
        <InventoryContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function InventoryContent() {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<InventoryFilters>(
    createEmptyInventoryFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<InventoryFilters>(
    createEmptyInventoryFilters()
  );
  const [stockInValues, setStockInValues] = useState<StockInInputValues>(
    createEmptyStockInFormValues()
  );
  const [adjustValues, setAdjustValues] = useState<AdjustInputValues>(
    createEmptyAdjustStockFormValues()
  );
  const [transferValues, setTransferValues] = useState<TransferInputValues>(
    createEmptyTransferStockFormValues()
  );
  const [stockInErrors, setStockInErrors] = useState<FieldErrors<StockInInputValues>>({});
  const [adjustErrors, setAdjustErrors] = useState<FieldErrors<AdjustInputValues>>({});
  const [transferErrors, setTransferErrors] = useState<FieldErrors<TransferInputValues>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const inventoryRequest = useMemo(
    () => buildInventoryRequest(appliedFilters),
    [appliedFilters]
  );
  const lookupQuery = useMemo(
    () => ({
      limit: 100
    }),
    []
  );
  const scopedQuery = useMemo(
    () =>
      buildInventoryRequest({
        ...appliedFilters,
        lowStock: false,
        nearExpiry: false
      }).query,
    [appliedFilters]
  );

  const warehousesQuery = useQuery({
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: lookupQuery
      }),
    queryKey: ["admin", "inventory", "warehouses"]
  });
  const productsQuery = useQuery({
    queryFn: () =>
      api.request<ProductListResponse>("/products", {
        query: lookupQuery
      }),
    queryKey: ["admin", "inventory", "products"]
  });
  const inventoryQuery = useQuery({
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
    queryFn: () =>
      api.request<PaginatedResponse<InventoryStock>>("/admin/inventory/low-stock", {
        query: scopedQuery
      }),
    queryKey: ["admin", "inventory", "low-stock", scopedQuery]
  });
  const nearExpiryQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedResponse<StockBatch>>("/admin/inventory/near-expiry", {
        query: {
          ...scopedQuery,
          days: 30
        }
      }),
    queryKey: ["admin", "inventory", "near-expiry", scopedQuery]
  });
  const movementsQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedResponse<StockMovement>>("/admin/inventory/movements", {
        query: scopedQuery
      }),
    queryKey: ["admin", "inventory", "movements", scopedQuery]
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

  const products = productsQuery.data?.items ?? [];
  const warehouses = warehousesQuery.data?.items ?? [];
  const stockInVariants = getProductVariants(products, stockInValues.productId);
  const adjustVariants = getProductVariants(products, adjustValues.productId);
  const transferVariants = getProductVariants(products, transferValues.productId);
  const lowStockItems = lowStockQuery.data?.items ?? [];
  const nearExpiryItems = nearExpiryQuery.data?.items ?? [];
  const movements = movementsQuery.data?.items ?? [];
  const lowStockKeys = new Set(lowStockItems.map(stockKey));
  const nearExpiryKeys = new Set(nearExpiryItems.map(batchKey));
  const mutationError =
    getErrorMessage(stockInMutation.error) ??
    getErrorMessage(adjustMutation.error) ??
    getErrorMessage(transferMutation.error);
  const isMutating =
    stockInMutation.isPending || adjustMutation.isPending || transferMutation.isPending;

  async function refreshInventory() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = inventoryFiltersSchema.safeParse(draftFilters);

    if (parsed.success) {
      setAppliedFilters(parsed.data);
    }
  }

  function resetFilters() {
    const emptyFilters = createEmptyInventoryFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
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
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Inventory control</p>
            <h2>Stock by warehouse, batch, expiry, and movement</h2>
            <p className="panelSummary">
              Monitor assigned warehouse stock and run controlled stock changes.
            </p>
          </div>
          <button
            className="ghostButton iconTextButton"
            onClick={() => void refreshInventory()}
            type="button"
          >
            <RefreshCw aria-hidden size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <article className="metric metric--primary">
            <span>Stock rows</span>
            <strong>{inventoryRequest.type === "stock" ? inventoryQuery.data?.pagination.total ?? 0 : lowStockItems.length}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Low stock</span>
            <strong>{lowStockQuery.data?.pagination.total ?? lowStockItems.length}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Near expiry</span>
            <strong>{nearExpiryQuery.data?.pagination.total ?? nearExpiryItems.length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Movements</span>
            <strong>{movementsQuery.data?.pagination.total ?? movements.length}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find stock</h2>
          </div>
        </div>
        <InventoryFilterForm
          filters={draftFilters}
          isLoading={productsQuery.isLoading || warehousesQuery.isLoading}
          onChange={setDraftFilters}
          onReset={resetFilters}
          onSubmit={handleFilterSubmit}
          products={products}
          warehouses={warehouses}
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
      </section>

      <PermissionGate permission={ADMIN_PERMISSION.InventoryUpdate}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Stock actions</p>
              <h2>Receive, adjust, and transfer stock</h2>
            </div>
          </div>
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
        </section>
      </PermissionGate>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Stock table</p>
            <h2>{inventoryRequest.type === "batch" ? "Near-expiry batches" : "Current aggregate stock"}</h2>
          </div>
        </div>
        {inventoryQuery.isLoading ? (
          <div className="loadingBlock">Loading inventory...</div>
        ) : null}
        {inventoryQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(inventoryQuery.error) ?? "Unable to load inventory."}
          </p>
        ) : null}
        {inventoryRequest.type === "batch" ? (
          <BatchTable
            batches={(inventoryQuery.data?.items ?? []) as StockBatch[]}
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
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Near expiry</p>
            <h2>Positive batches expiring soon</h2>
          </div>
        </div>
        {nearExpiryQuery.isLoading ? (
          <div className="loadingBlock">Loading near-expiry batches...</div>
        ) : null}
        {nearExpiryQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(nearExpiryQuery.error) ?? "Unable to load near-expiry batches."}
          </p>
        ) : null}
        <BatchTable batches={nearExpiryItems} products={products} warehouses={warehouses} />
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Movement history</p>
            <h2>Stock movement audit trail</h2>
          </div>
        </div>
        {movementsQuery.isLoading ? (
          <div className="loadingBlock">Loading movement history...</div>
        ) : null}
        {movementsQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(movementsQuery.error) ?? "Unable to load stock movements."}
          </p>
        ) : null}
        <MovementTable movements={movements} products={products} warehouses={warehouses} />
      </section>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function InventoryFilterForm({
  filters,
  isLoading,
  onChange,
  onReset,
  onSubmit,
  products,
  warehouses
}: {
  filters: InventoryFilters;
  isLoading: boolean;
  onChange: (filters: InventoryFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  products: AdminProduct[];
  warehouses: AdminWarehouse[];
}) {
  return (
    <form className="inventoryFilters" onSubmit={onSubmit}>
      <label>
        Search
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <input
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Product or SKU"
            value={filters.search}
          />
        </span>
      </label>
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
      <label className="checkField rowCheck">
        <input
          checked={filters.lowStock}
          onChange={(event) => onChange({ ...filters, lowStock: event.target.checked })}
          type="checkbox"
        />
        <span>Low stock</span>
      </label>
      <label className="checkField rowCheck">
        <input
          checked={filters.nearExpiry}
          onChange={(event) => onChange({ ...filters, nearExpiry: event.target.checked })}
          type="checkbox"
        />
        <span>Near expiry</span>
      </label>
      <div className="productFilterActions">
        <button className="primaryButton iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </button>
        <button className="ghostButton" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </form>
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
      <TextField error={errors.batchNumber} label="Batch number" onChange={(value) => updateValue("batchNumber", value)} value={values.batchNumber} />
      <TextField error={errors.expiryDate} label="Expiry date" onChange={(value) => updateValue("expiryDate", value)} required={false} type="date" value={values.expiryDate} />
      <TextField error={errors.quantity} inputMode="numeric" label="Quantity" onChange={(value) => updateValue("quantity", value)} value={values.quantity} />
      <TextField error={errors.purchasePrice} inputMode="decimal" label="Purchase price" onChange={(value) => updateValue("purchasePrice", value)} value={values.purchasePrice} />
      <TextField error={errors.sellingPrice} inputMode="decimal" label="Selling price" onChange={(value) => updateValue("sellingPrice", value)} value={values.sellingPrice} />
      <TextField error={errors.mrp} inputMode="decimal" label="MRP" onChange={(value) => updateValue("mrp", value)} value={values.mrp} />
      <TextField error={errors.lowStockThreshold} inputMode="numeric" label="Low-stock threshold" onChange={(value) => updateValue("lowStockThreshold", value)} required={false} value={values.lowStockThreshold} />
      <TextAreaField error={errors.notes} label="Notes" onChange={(value) => updateValue("notes", value)} value={values.notes} />
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
      <TextField error={errors.batchNumber} label="Batch number" onChange={(value) => updateValue("batchNumber", value)} required={false} value={values.batchNumber} />
      <TextField error={errors.quantityDelta} inputMode="numeric" label="Quantity delta" onChange={(value) => updateValue("quantityDelta", value)} value={values.quantityDelta} />
      <TextField error={errors.lowStockThreshold} inputMode="numeric" label="Low-stock threshold" onChange={(value) => updateValue("lowStockThreshold", value)} required={false} value={values.lowStockThreshold} />
      <TextAreaField error={errors.reason} label="Reason" onChange={(value) => updateValue("reason", value)} required value={values.reason} />
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
      <TextField error={errors.batchNumber} label="Batch number" onChange={(value) => updateValue("batchNumber", value)} required={false} value={values.batchNumber} />
      <TextField error={errors.quantity} inputMode="numeric" label="Quantity" onChange={(value) => updateValue("quantity", value)} value={values.quantity} />
      <TextAreaField error={errors.notes} label="Notes" onChange={(value) => updateValue("notes", value)} value={values.notes} />
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
    <form className="formStack compactForm inventoryActionForm" onSubmit={onSubmit}>
      <h3>
        {icon}
        <span>{title}</span>
      </h3>
      {children}
      <button className="primaryButton iconTextButton" disabled={isSaving} type="submit">
        <CheckCircle2 aria-hidden size={16} />
        <span>{isSaving ? "Working..." : submitLabel}</span>
      </button>
    </form>
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
  return (
    <label>
      Product
      <select
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{required ? "Select product" : "All products"}</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name} ({product.sku})
          </option>
        ))}
      </select>
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
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
    <label>
      Variant
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">No variant</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.name} ({variant.sku})
          </option>
        ))}
      </select>
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
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
  return (
    <label>
      {label}
      <select
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{required ? "Select warehouse" : "All warehouses"}</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name} ({warehouse.code})
          </option>
        ))}
      </select>
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
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
    <label>
      {label}
      <input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
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
    <label>
      {label}
      <textarea
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
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
    return <div className="emptyPanel smallEmpty">No stock rows match the selected filters.</div>;
  }

  return (
    <div className="inventoryTable" role="table">
      <div className="inventoryTableHeader" role="row">
        <strong role="columnheader">Product</strong>
        <strong role="columnheader">Warehouse</strong>
        <strong role="columnheader">Available</strong>
        <strong role="columnheader">Reserved</strong>
        <strong role="columnheader">Threshold</strong>
        <strong role="columnheader">Warnings</strong>
      </div>
      {stocks.map((stock) => {
        const key = stockKey(stock);
        const low = lowStockKeys.has(key) || isLowStock(stock);
        const nearExpiry = nearExpiryKeys.has(key);

        return (
          <div className="inventoryTableRow" key={stock.id} role="row">
            <span role="cell">
              <strong>{productLabel(products, stock.productId, stock.variantId)}</strong>
            </span>
            <span role="cell">{warehouseLabel(warehouses, stock.warehouseId)}</span>
            <span role="cell">{stock.availableQuantity}</span>
            <span role="cell">{stock.reservedQuantity}</span>
            <span role="cell">{stock.lowStockThreshold}</span>
            <span className="flagList" role="cell">
              {low ? <b>Low stock</b> : null}
              {nearExpiry ? <b>Near expiry</b> : null}
              {!low && !nearExpiry ? <span>-</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BatchTable({
  batches,
  products,
  warehouses
}: {
  batches: StockBatch[];
  products: AdminProduct[];
  warehouses: AdminWarehouse[];
}) {
  if (batches.length === 0) {
    return <div className="emptyPanel smallEmpty">No batches match the selected filters.</div>;
  }

  return (
    <div className="inventoryTable" role="table">
      <div className="inventoryTableHeader batchInventoryTableHeader" role="row">
        <strong role="columnheader">Batch</strong>
        <strong role="columnheader">Product</strong>
        <strong role="columnheader">Warehouse</strong>
        <strong role="columnheader">Quantity</strong>
        <strong role="columnheader">Expiry</strong>
        <strong role="columnheader">Prices</strong>
      </div>
      {batches.map((batch) => (
        <div className="inventoryTableRow batchInventoryTableRow" key={batch.id} role="row">
          <span role="cell">
            <strong>{batch.batchNumber}</strong>
          </span>
          <span role="cell">{productLabel(products, batch.productId, batch.variantId)}</span>
          <span role="cell">{warehouseLabel(warehouses, batch.warehouseId)}</span>
          <span role="cell">{batch.quantity}</span>
          <span className="flagList" role="cell">
            <span>{formatDate(batch.expiryDate)}</span>
            {isNearExpiry(batch.expiryDate) ? <b>Near expiry</b> : null}
          </span>
          <span role="cell">
            {formatCurrency(batch.sellingPrice)} / {formatCurrency(batch.mrp)}
          </span>
        </div>
      ))}
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
    return <div className="emptyPanel smallEmpty">No stock movements match the selected filters.</div>;
  }

  return (
    <div className="inventoryTable" role="table">
      <div className="inventoryTableHeader movementTableHeader" role="row">
        <strong role="columnheader">Type</strong>
        <strong role="columnheader">Product</strong>
        <strong role="columnheader">Warehouse</strong>
        <strong role="columnheader">Quantity</strong>
      </div>
      {movements.map((movement) => (
        <div className="inventoryTableRow movementTableRow" key={movement.id} role="row">
          <span role="cell">{formatMovementType(movement.type)}</span>
          <span role="cell">{productLabel(products, movement.productId, movement.variantId)}</span>
          <span role="cell">{warehouseLabel(warehouses, movement.warehouseId)}</span>
          <span role="cell">{movement.quantity}</span>
        </div>
      ))}
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
  return warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId;
}

function getProductVariants(products: AdminProduct[], productId: string) {
  return products.find((product) => product.id === productId)?.variants ?? [];
}

function stockKey(stock: Pick<InventoryStock, "productId" | "variantId" | "warehouseId">) {
  return `${stock.productId}:${stock.variantId ?? ""}:${stock.warehouseId}`;
}

function batchKey(batch: Pick<StockBatch, "productId" | "variantId" | "warehouseId">) {
  return `${batch.productId}:${batch.variantId ?? ""}:${batch.warehouseId}`;
}

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getFieldErrors<TFields extends Record<string, unknown>>(
  error: z.ZodError
) {
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
