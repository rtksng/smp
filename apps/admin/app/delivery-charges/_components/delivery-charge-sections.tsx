"use client";

import { BulkActions, BulkPageCheckbox, BulkRowCheckbox } from "@/components/admin/bulk-actions";
import { loadBulkRows } from "@/lib/bulk-actions";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import { activeResourceBulkActions } from "@/lib/bulk-resource-actions";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
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
import { AdminShell } from "../../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import {
  buildDeliveryChargePayload,
  buildDeliveryChargeQuery,
  createEmptyDeliveryChargeFilters,
  createEmptyDeliveryChargeFormValues,
  formatCurrency,
  formatDeliveryDateParts,
  formatDeliveryRange,
  formatDeliveryScope,
  validateDeliveryChargeFilters,
  validateDeliveryChargeForm,
  type AdminDeliveryChargeRule,
  type DeliveryChargeFieldErrors,
  type DeliveryChargeFilters,
  type DeliveryChargeFormValues,
  type DeliveryChargePayload,
  type PaginatedDeliveryChargeResponse
} from "../../../lib/delivery-charge-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import { useTableOverflow } from "../../../lib/use-table-overflow";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
import "../delivery-charges-responsive.css";

const PAGE_SIZE = 20;

type DeliveryChargeView = "rules" | "new";
export type DeliveryChargeWarehouse = Pick<
  WarehouseListResponse["items"][number],
  "id" | "name" | "code"
>;

const deliveryChargeSections: Array<{
  description: string;
  href: string;
  id: DeliveryChargeView;
  title: string;
}> = [
  {
    description: "Search, filter, edit, archive, and review checkout delivery fees.",
    href: "/delivery-charges/rules",
    id: "rules",
    title: "Rules"
  },
  {
    description: "Create a new pincode, warehouse, or order-value based rule.",
    href: "/delivery-charges/new",
    id: "new",
    title: "New rule"
  }
];

const deliveryChargeCopy: Record<
  DeliveryChargeView,
  { summary: string; title: string }
> = {
  new: {
    summary: "Create one focused rule without the table, filters, and edit state competing for space.",
    title: "Create delivery charge rule"
  },
  rules: {
    summary: "Search, filter, edit, and archive delivery charge rules in a table-first workspace.",
    title: "Delivery charge rules"
  }
};

export function DeliveryChargesRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function DeliveryChargeRulesPage() {
  return <DeliveryChargesContent view="rules" />;
}

export function DeliveryChargeCreatePage() {
  return <DeliveryChargesContent view="new" />;
}

function DeliveryChargesContent({ view }: { view: DeliveryChargeView }) {
  const { api, hasPermission } = useAdminSession();
  const canReadWarehouses = hasPermission(ADMIN_PERMISSION.WarehouseRead);
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<DeliveryChargeFilters>(
    createEmptyDeliveryChargeFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<DeliveryChargeFilters>(
    createEmptyDeliveryChargeFilters()
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [formValues, setFormValues] = useState<DeliveryChargeFormValues>(
    createEmptyDeliveryChargeFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<DeliveryChargeFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const ruleQuery = useMemo(
    () => buildDeliveryChargeQuery(appliedFilters, page, PAGE_SIZE),
    [appliedFilters, page]
  );
  const rulesQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedDeliveryChargeResponse>(
        "/admin/delivery-charge-rules",
        {
          query: ruleQuery
        }
      ),
    queryKey: ["admin", "delivery-charge-rules", ruleQuery]
  });
  const warehousesQuery = useQuery({
    enabled: canReadWarehouses,
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: {
          limit: 100,
          status: "ACTIVE"
        }
      }),
    queryKey: ["admin", "warehouses", "active"]
  });
  const createMutation = useMutation({
    mutationFn: (payload: DeliveryChargePayload) =>
      api.request<AdminDeliveryChargeRule>("/admin/delivery-charge-rules", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<AdminDeliveryChargeRule>(`/admin/delivery-charge-rules/${id}`, {
        method: "DELETE"
      })
  });
  const rules = useMemo(() => rulesQuery.data?.items ?? [], [rulesQuery.data?.items]);
  const warehouses = useMemo(() => {
    const options = new Map<string, DeliveryChargeWarehouse>();
    for (const warehouse of [
      ...(warehousesQuery.data?.items ?? []),
      ...rules.flatMap((rule) => rule.warehouse ? [rule.warehouse] : [])
    ]) {
      options.set(warehouse.id, warehouse);
    }
    if (draftFilters.warehouseId && !options.has(draftFilters.warehouseId)) {
      options.set(draftFilters.warehouseId, { id: draftFilters.warehouseId, code: "", name: "Selected warehouse" });
    }
    return [...options.values()];
  }, [warehousesQuery.data?.items, rules, draftFilters.warehouseId]);
  const bulk = useBulkSelection(JSON.stringify(appliedFilters), rules);
  const pagination = rulesQuery.data?.pagination;
  const activeVisibleCount = rules.filter((rule) => rule.isActive).length;
  const pincodeVisibleCount = rules.filter((rule) => rule.pincode !== null).length;
  const warehouseVisibleCount = rules.filter(
    (rule) => rule.warehouseId !== null
  ).length;
  const error =
    getErrorMessage(rulesQuery.error) ??
    getErrorMessage(warehousesQuery.error) ??
    saveError;
  const isSaving = createMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  useEffect(() => {
    if (pagination && page > Math.max(pagination.totalPages, 1)) {
      setPage(Math.max(pagination.totalPages, 1));
    }
  }, [page, pagination]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilterError = validateDeliveryChargeFilters(draftFilters);
    setFilterError(nextFilterError);
    if (nextFilterError) {
      return;
    }
    setPage(1);
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
  }

  function resetFilters() {
    const emptyFilters = createEmptyDeliveryChargeFilters();
    setFilterError(null);
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  async function refreshRules() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin", "delivery-charge-rules"]
      }),
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] })
    ]);
  }

  function updateFormValue<TKey extends keyof DeliveryChargeFormValues>(
    key: TKey,
    value: DeliveryChargeFormValues[TKey]
  ) {
    if (isSaving) return;
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    if (isSaving) return;
    setFieldErrors({});
    setSaveError(null);
    setFormValues(createEmptyDeliveryChargeFormValues());
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    setMessage(null);
    setSaveError(null);
    const errors = validateDeliveryChargeForm(formValues);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    const payload = buildDeliveryChargePayload(formValues);

    try {
      await createMutation.mutateAsync(payload);
      setMessage("Delivery charge rule created.");

      resetForm();
      await refreshRules();
    } catch (error) {
      setSaveError(getErrorMessage(error) ?? "Unable to save the delivery charge rule. Please try again.");
    }
  }

  function confirmDelete(rule: AdminDeliveryChargeRule) {
    if (isSaving || isDeleting) return;
    setConfirmation({
      body: `Archive ${rule.name}? Matching carts and new orders will stop using this delivery charge rule.`,
      confirmLabel: "Archive rule",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(rule.id);
        setMessage("Delivery charge rule archived.");

        await refreshRules();
      },
      title: "Archive delivery charge rule"
    });
  }

  const pageCopy = deliveryChargeCopy[view];
  return (
    <div className="deliveryChargeModule" data-delivery-charge-view={view}>
      <section className="panel deliveryChargeOverviewPanel">
        <DeliveryChargeSectionNav active={view} />
        <PageHeader
          actions={
            <div className="actionRow deliveryChargeHeaderActions">
              {view === "rules" ? (
                <Button
                  aria-label="Add filter"
                  className="iconTextButton"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <SlidersHorizontal aria-hidden size={16} />
                  <span className="deliveryChargeActionLabelFull">Add filter</span>
                  <span className="deliveryChargeActionLabelCompact">Filter</span>
                </Button>
              ) : null}
              <Button
                className="iconTextButton"
                onClick={() => void refreshRules()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
              {view === "rules" ? (
                <Button asChild className="iconTextButton">
                  <Link aria-label="New rule" href="/delivery-charges/new">
                    <Plus aria-hidden size={16} />
                    <span className="deliveryChargeActionLabelFull">New rule</span>
                    <span className="deliveryChargeActionLabelCompact">New</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          }
          backHref={view === "new" ? "/delivery-charges/rules" : undefined}
          backLabel="Back to rules"
          className="deliveryChargePageHeader"
          eyebrow="Delivery charges"
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}

        {view === "rules" ? (
          <div className="metricGrid resourceMetrics deliveryChargeMetricGrid">
            <MetricCard label="Total rules" tone="primary" value={pagination?.total ?? 0} />
            <MetricCard label="Visible" value={rules.length} />
            <MetricCard label="Active visible" value={activeVisibleCount} />
            <MetricCard label="Pincode rules" value={pincodeVisibleCount} />
            <MetricCard label="Warehouse rules" value={warehouseVisibleCount} />
          </div>
        ) : null}
      </section>

      {view === "rules" ? (
        <FilterDrawer
          error={filterError}
          isOpen={isFilterDrawerOpen}
          isSubmitting={rulesQuery.isFetching}
          onApply={applyFilters}
          onOpenChange={setIsFilterDrawerOpen}
          onReset={resetFilters}
          title="Delivery charge filters"
        >
          <DeliveryChargeFilterFields
            filters={draftFilters}
            isWarehouseLoading={canReadWarehouses && warehousesQuery.isLoading}
            onChange={setDraftFilters}
            warehouses={warehouses}
          />
        </FilterDrawer>
      ) : null}

      {view === "new" ? (
        <section className="panel deliveryChargeFormPanel deliveryChargeFormOnlyPanel mt-3">
          <DeliveryChargeForm
            errors={fieldErrors}
            isEditing={false}
            isSaving={isSaving}
            onCancel={resetForm}
            onChange={updateFormValue}
            onSubmit={saveRule}
            values={formValues}
            warehouses={warehouses}
          />
        </section>
      ) : null}

      {view === "rules" ? (
        <div className="deliveryChargeWorkspaceGrid deliveryChargeWorkspaceGrid--single">
          <section className="panel deliveryChargeRulesPanel mt-3">
            <PageHeader
              className="settingsSectionHeader"
              eyebrow="Rule list"
              level={2}
              summary="Use filters first, then edit or archive rules directly from the table."
              title="Checkout shipping fees"
            />

            {rulesQuery.isLoading ? (
              <LoadingState label="Loading delivery charge rules..." />
            ) : null}
            <div className="deliveryChargeBulkActions">
              <BulkActions
                actions={activeResourceBulkActions<AdminDeliveryChargeRule>(
                  api,
                  "delivery-charge-rules"
                )}
                disabled={
                  rulesQuery.isFetching ||
                  rulesQuery.isError ||
                  isSaving ||
                  isDeleting
                }
                getLabel={(rule) => rule.name}
                key={bulk.scope}
                loadAll={() =>
                  loadBulkRows((next, limit) =>
                    api.request<PaginatedDeliveryChargeResponse>(
                      "/admin/delivery-charge-rules",
                      { query: buildDeliveryChargeQuery(appliedFilters, next, limit) }
                    )
                  )
                }
                onComplete={refreshRules}
                selection={bulk}
                total={pagination?.total ?? 0}
              />
            </div>
            {!rulesQuery.isLoading && !rulesQuery.isError && rules.length === 0 ? (
              <EmptyState
                body="No delivery charge rules match the current filters."
                title="No delivery charge rules found"
              />
            ) : null}
            {rules.length > 0 ? (
              <DeliveryChargeRulesTable
                bulk={bulk}
                isSaving={isSaving}
                isDeleting={isDeleting || bulk.isBusy}
                onDelete={confirmDelete}
                rules={rules}
              />
            ) : null}
            {pagination ? (
              <PaginationControls
                ariaLabel="Delivery charge rules pagination"
                isPending={rulesQuery.isFetching && !rulesQuery.isLoading}
                onChange={(next) => { if (!bulk.isBusy) setPage(next); }}
                page={pagination.page}
                pageSize={pagination.limit}
                totalItems={pagination.total}
                totalPages={Math.max(pagination.totalPages, 1)}
              />
            ) : null}
          </section>

        </div>
      ) : null}

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isDeleting}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </div>
  );
}

export function DeliveryChargeSectionNav({ active }: { active: DeliveryChargeView }) {
  return (
    <nav className="deliveryChargeSectionNav" aria-label="Delivery charge sections">
      {deliveryChargeSections.map((section) => (
        <Link
          aria-current={active === section.id ? "page" : undefined}
          href={section.href}
          key={section.id}
        >
          {section.title}
        </Link>
      ))}
    </nav>
  );
}

export function DeliveryChargeForm({
  errors,
  isEditing,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  values,
  warehouses
}: {
  errors: DeliveryChargeFieldErrors;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: <TKey extends keyof DeliveryChargeFormValues>(
    key: TKey,
    value: DeliveryChargeFormValues[TKey]
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: DeliveryChargeFormValues;
  warehouses: DeliveryChargeWarehouse[];
}) {
  return (
    <form className="formStack productForm deliveryChargeForm" onSubmit={onSubmit}>
      <div className="formGrid deliveryChargeFormGrid">
        <TextField
          error={errors.name}
          label="Rule name"
          onChange={(value) => onChange("name", value)}
          placeholder="Delhi local delivery"
          value={values.name}
        />
        <TextField
          error={errors.charge}
          label="Delivery charge"
          onChange={(value) => onChange("charge", value)}
          placeholder="75"
          type="number"
          value={values.charge}
        />
        <TextField
          error={errors.pincode}
          label="Pincode"
          onChange={(value) => onChange("pincode", value)}
          placeholder="Blank for all"
          value={values.pincode}
        />
        <label>
          Warehouse
          <Select
            aria-label="Warehouse"
            onValueChange={(value) => onChange("warehouseId", value)}
            value={values.warehouseId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem
                  key={warehouse.id}
                  textValue={`${warehouse.code} ${warehouse.name}`}
                  value={warehouse.id}
                >
                  {warehouse.code} - {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <TextField
          error={errors.minOrderAmount}
          label="Minimum order amount"
          onChange={(value) => onChange("minOrderAmount", value)}
          placeholder="Blank for no minimum"
          type="number"
          value={values.minOrderAmount}
        />
        <TextField
          error={errors.maxOrderAmount}
          label="Maximum order amount"
          onChange={(value) => onChange("maxOrderAmount", value)}
          placeholder="Blank for no maximum"
          type="number"
          value={values.maxOrderAmount}
        />
        <TextField
          error={errors.freeDeliveryThreshold}
          label="Free delivery threshold"
          onChange={(value) => onChange("freeDeliveryThreshold", value)}
          placeholder="Blank to always charge"
          type="number"
          value={values.freeDeliveryThreshold}
        />
        <TextField
          error={errors.priority}
          label="Priority"
          onChange={(value) => onChange("priority", value)}
          placeholder="0"
          step="1"
          type="number"
          value={values.priority}
        />
      </div>
      <div className="deliveryChargeFormFooter">
        <Label className="checkField rowCheck deliveryChargeActiveField">
          <Checkbox
            checked={values.isActive}
            onCheckedChange={(checked) => onChange("isActive", checked === true)}
          />
          <span>Active for checkout</span>
        </Label>
        <div className="actionRow deliveryChargeFormActions">
          <Button className="iconTextButton" disabled={isSaving} type="submit">
            {isEditing ? <CheckCircle2 aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
            <span>{isSaving ? "Saving..." : isEditing ? "Save changes" : "Create rule"}</span>
          </Button>
          {isEditing ? (
            <Button
              className="iconTextButton"
              disabled={isSaving}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              <X aria-hidden size={16} />
              <span>Cancel edit</span>
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function DeliveryChargeFilterFields({
  filters,
  isWarehouseLoading,
  onChange,
  warehouses
}: {
  filters: DeliveryChargeFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: DeliveryChargeFilters) => void;
  warehouses: DeliveryChargeWarehouse[];
}) {
  return (
    <div className="filterDrawerFields">
      <label>
        Search
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Rule name"
          value={filters.search}
        />
      </label>
      <label>
        Pincode
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, pincode: event.target.value })}
          placeholder="110001"
          value={filters.pincode}
        />
      </label>
      <label>
        Warehouse
        <Select
          aria-label="Warehouse"
          disabled={isWarehouseLoading}
          onValueChange={(value) => onChange({ ...filters, warehouseId: value })}
          value={filters.warehouseId}
        >
          <SelectTrigger className="filterDrawerControl">
            <SelectValue placeholder="Any warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any warehouse</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem
                key={warehouse.id}
                textValue={`${warehouse.code} ${warehouse.name}`}
                value={warehouse.id}
              >
                {warehouse.code} - {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label>
        Status
        <Select
          aria-label="Status"
          onValueChange={(value) =>
            onChange({
              ...filters,
              isActive: value as DeliveryChargeFilters["isActive"]
            })
          }
          value={filters.isActive}
        >
          <SelectTrigger className="filterDrawerControl">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

function DeliveryChargeRulesTable({
  bulk,
  isDeleting,
  isSaving,
  onDelete,
  rules
}: {
  isDeleting: boolean;
  isSaving: boolean;
  onDelete: (rule: AdminDeliveryChargeRule) => void;
  bulk: BulkSelection<AdminDeliveryChargeRule>;
  rules: AdminDeliveryChargeRule[];
}) {
  const { isOverflowing, shellRef } = useTableOverflow();

  return (
    <div
      className="resourceTable deliveryChargeTableShell deliveryChargeRulesTable"
      data-overflowing={isOverflowing ? "true" : undefined}
      ref={shellRef}
    >
      {isOverflowing ? (
        <p className="deliveryChargeTableHint" id="delivery-charge-table-hint">
          Swipe sideways to view every delivery charge rule detail.
        </p>
      ) : null}
      <Table
        aria-describedby="delivery-charge-table-hint"
        aria-label="Delivery charge rules"
        className="deliveryChargeDataTable"
        containerClassName="deliveryChargeTableViewport"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="bulkCheckboxCell">
              <BulkPageCheckbox selection={bulk} />
            </TableHead>
            <TableHead className="deliveryChargeRuleCell">Rule</TableHead>
            <TableHead>Charge</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Order range</TableHead>
            <TableHead>Free threshold</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="deliveryChargeActionsCell">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell className="bulkCheckboxCell">
                <BulkRowCheckbox
                  item={rule}
                  label={rule.name}
                  selection={bulk}
                />
              </TableCell>
              <TableCell className="deliveryChargeRuleCell">
                <strong title={rule.name}>{rule.name}</strong>
                <em>Priority {rule.priority}</em>
              </TableCell>
              <TableCell className="deliveryChargeChargeCell" data-label="Charge">
                <strong>{formatCurrency(rule.charge)}</strong>
              </TableCell>
              <TableCell className="deliveryChargeStatusCell">
                <StatusBadge status={rule.isActive ? "ACTIVE" : "INACTIVE"} />
              </TableCell>
              <TableCell className="deliveryChargeScopeCell" data-label="Scope">
                <strong>{formatDeliveryScope(rule)}</strong>
                <em title={rule.warehouse?.name}>
                  {rule.warehouse?.name ?? "No warehouse restriction"}
                </em>
              </TableCell>
              <TableCell className="deliveryChargeRangeCell" data-label="Order range">
                {formatDeliveryRange(rule)}
              </TableCell>
              <TableCell className="deliveryChargeFreeCell" data-label="Free threshold">
                {formatCurrency(rule.freeDeliveryThreshold)}
              </TableCell>
              <TableCell className="deliveryChargeUpdatedCell" data-label="Updated">
                <span className="deliveryChargeCellText">
                  {formatDeliveryDateParts(rule.updatedAt).date}
                </span>
                <em>{formatDeliveryDateParts(rule.updatedAt).time}</em>
              </TableCell>
              <TableCell className="deliveryChargeActionsCell">
                <div className="tableActions">
                  <Button
                    asChild
                    className="tableIconButton"
                    size="icon"
                    variant="outline"
                  >
                    <Link
                      aria-label={`Edit ${rule.name}`}
                      href={`/delivery-charges/${encodeURIComponent(rule.id)}/edit`}
                      title="Edit"
                    >
                      <Pencil aria-hidden size={16} />
                    </Link>
                  </Button>
                  <Button
                    aria-label={`Archive ${rule.name}`}
                    className="tableIconButton"
                    disabled={isSaving || isDeleting}
                    onClick={() => onDelete(rule)}
                    size="icon"
                    title="Archive"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 aria-hidden size={16} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TextField({
  error,
  label,
  onChange,
  placeholder,
  step,
  type = "text",
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
  type?: string;
  value: string;
}) {
  return (
    <label>
      {label}
      <Input
        aria-label={label}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step={type === "number" ? step ?? "0.01" : undefined}
        type={type}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
